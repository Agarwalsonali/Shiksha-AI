import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse } from '../utils/apiResponse';
import { NotFoundError, DatabaseError } from '../utils/apiError';
import type { UpdateProfileInput, UpdateTopicsInput } from '../schemas/profile.schema';

/**
 * Get user profile
 * GET /api/profile
 * Requires authentication
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw new DatabaseError(error.message);
  if (!data) throw new NotFoundError('Profile not found');

  res.json(successResponse(data));
};

/**
 * Update user profile
 * PATCH /api/profile
 * Requires authentication
 */
export const updateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const updates: UpdateProfileInput = req.body;

  // Ensure we have at least one field to update
  if (Object.keys(updates).length === 0) {
    return res.json(successResponse(null, 'No updates provided'));
  }

  const { data, error } = await supabase
    .from('user_profile')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new DatabaseError(error.message);
  if (!data) throw new NotFoundError('Profile not found');

  res.json(successResponse(data, 'Profile updated successfully'));
};

/**
 * Update weak/strong topics (add or remove)
 * PATCH /api/profile/topics
 * Requires authentication
 */
export const updateTopics = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { weak_topics, strong_topics }: UpdateTopicsInput = req.body;

  // First, get current profile to work with existing arrays
  const { data: currentProfile, error: fetchError } = await supabase
    .from('user_profile')
    .select('weak_topics, strong_topics')
    .eq('user_id', userId)
    .single();

  if (fetchError) throw new DatabaseError(fetchError.message);
  if (!currentProfile) throw new NotFoundError('Profile not found');

  // Process weak topics
  let newWeakTopics = currentProfile.weak_topics || [];
  if (weak_topics?.add) {
    newWeakTopics = [...new Set([...newWeakTopics, ...weak_topics.add])];
  }
  if (weak_topics?.remove) {
    newWeakTopics = newWeakTopics.filter((topic: string) => !weak_topics.remove?.includes(topic));
  }

  // Process strong topics
  let newStrongTopics = currentProfile.strong_topics || [];
  if (strong_topics?.add) {
    newStrongTopics = [...new Set([...newStrongTopics, ...strong_topics.add])];
  }
  if (strong_topics?.remove) {
    newStrongTopics = newStrongTopics.filter((topic: string) => !strong_topics.remove?.includes(topic));
  }

  // Update profile with new topic arrays
  const { data, error } = await supabase
    .from('user_profile')
    .update({
      weak_topics: newWeakTopics,
      strong_topics: newStrongTopics,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new DatabaseError(error.message);

  res.json(successResponse(data, 'Topics updated successfully'));
};

/**
 * Get full user profile with user data
 * GET /api/profile/full
 * Requires authentication
 * Returns user + profile combined
 */
export const getFullProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const { data, error } = await supabase
    .from('users')
    .select('*, user_profile(*)')
    .eq('id', userId)
    .single();

  if (error) throw new DatabaseError(error.message);
  if (!data) throw new NotFoundError('User not found');

  res.json(successResponse(data));
};
