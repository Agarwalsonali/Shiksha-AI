import { apiClient } from './client';
import type { User, UserWithProfile, UserProfile } from '@/lib/types/user.types';
import type { SignupInput } from '@/lib/validations/auth.validation';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  profile: UserProfile;
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
}

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<AuthResponse>('/api/auth/login', credentials),

  signup: (data: SignupInput) =>
    apiClient.post<AuthResponse>('/api/auth/signup', data),

  logout: () => apiClient.post('/api/auth/logout'),

  me: () => apiClient.get<UserWithProfile>('/api/auth/me'),
};
