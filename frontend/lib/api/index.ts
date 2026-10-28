/**
 * API Services Index
 * Central export for all API service modules
 */

export { apiClient, API_URL } from './client';
export { authApi } from './auth.api';
export { progressApi } from './progress.api';
export { leaderboardApi } from './leaderboard.api';
export { intelligenceApi } from './intelligence.api';
export { tutorApi } from './tutor.api';

// Re-export types for convenience
export type * from '../types/api.types';
export type * from '../types/user.types';
export type * from '../types/progress.types';
export type * from '../types/leaderboard.types';
export type * from '../types/intelligence.types';
export type * from '../types/tutor.types';
