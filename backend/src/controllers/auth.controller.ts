import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { getAuthUserByEmail, supabase, supabaseClient } from '../db/supabase';
import { successResponse } from '../utils/apiResponse';
import {
  UnauthorizedError,
  DatabaseError,
  NotFoundError,
  RateLimitError,
} from '../utils/apiError';
import type { SignupInput, LoginInput } from '../schemas/auth.schema';

/**
 * Signup - Create new user with profile
 * POST /api/auth/signup
 */
export const signup = async (req: AuthRequest, res: Response) => {
  const data: SignupInput = req.body;

  // 1. Create auth user in Supabase Auth
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (authError) {
    if (authError.code === 'over_email_send_rate_limit') {
      throw new RateLimitError(
        'Email sending is temporarily rate-limited. Please wait a few minutes before trying again, or use an existing account to sign in.'
      );
    }

    throw new UnauthorizedError(authError.message);
  }
  if (!authData.user) throw new DatabaseError('User creation failed');

  // 2. Create user record in users table
  const { error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: data.email,
      name: data.name,
    });

  if (userError) {
    // Rollback: Delete auth user if user record creation fails
    await supabaseClient.auth.admin.deleteUser(authData.user.id);
    throw new DatabaseError(userError.message);
  }

  // 3. Create user profile in user_profile table
  const { error: profileError } = await supabase
    .from('user_profile')
    .insert({
      user_id: authData.user.id,
      class: data.class,
      board: data.board,
      subjects: data.subjects,
      weak_topics: [],
      strong_topics: [],
      target_exams: data.target_exams || [],
      daily_study_hours: data.daily_study_hours || 1,
    });

  if (profileError) {
    // Rollback: Delete user and auth user if profile creation fails
    await supabase.from('users').delete().eq('id', authData.user.id);
    await supabaseClient.auth.admin.deleteUser(authData.user.id);
    throw new DatabaseError(profileError.message);
  }

  res.status(201).json(
    successResponse(
      {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: data.name,
        },
        profile: {
          user_id: authData.user.id,
          class: data.class,
          board: data.board,
          subjects: data.subjects,
          weak_topics: [],
          strong_topics: [],
          target_exams: data.target_exams || [],
          daily_study_hours: data.daily_study_hours || 1,
        },
        session: authData.session,
      },
      'Account created successfully'
    )
  );
};

/**
 * Login - Authenticate user
 * POST /api/auth/login
 */
export const login = async (req: AuthRequest, res: Response) => {
  const { email, password }: LoginInput = req.body;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === 'email_not_confirmed') {
      const authUser = await getAuthUserByEmail(email);

      if (authUser?.email_confirmed_at) {
        throw new UnauthorizedError(
          'This account is verified, but Supabase rejected the login. Confirm that the frontend and backend use the same Supabase project, then reset the account password.'
        );
      }

      throw new UnauthorizedError(
        'Please verify your email address before signing in'
      );
    }

    throw new UnauthorizedError('Invalid email or password');
  }
  if (!data.user) throw new UnauthorizedError('Authentication failed');

  // Fetch user profile with weak_topics
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*, user_profile(*)')
    .eq('id', data.user.id)
    .single();

  if (userError) throw new DatabaseError(userError.message);

  res.json(
    successResponse(
      {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        },
        profile: userData.user_profile,
        session: data.session,
      },
      'Login successful'
    )
  );
};

/**
 * Logout - Sign out user
 * POST /api/auth/logout
 */
export const logout = async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    // Optional: Invalidate token on Supabase side
    await supabaseClient.auth.signOut();
  }

  res.json(successResponse(null, 'Logout successful'));
};

/**
 * Get current user with profile
 * GET /api/auth/me
 * Requires authentication
 */
export const getUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id; // Set by auth middleware

  if (!userId) throw new UnauthorizedError('User not authenticated');

  // Fetch user with profile
  const { data, error } = await supabase
    .from('users')
    .select('*, user_profile(*)')
    .eq('id', userId)
    .single();

  if (error) throw new DatabaseError(error.message);
  if (!data) throw new NotFoundError('User not found');

  // Return in expected format: { user, profile }
  res.json(successResponse({
    user: {
      id: data.id,
      email: data.email,
      name: data.name,
      created_at: data.created_at,
    },
    profile: data.user_profile,
  }));
};
