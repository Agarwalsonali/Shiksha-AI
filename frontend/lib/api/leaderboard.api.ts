/**
 * Leaderboard API Service
 * Handles class rankings and leaderboard data
 */

import { apiClient } from './client';
import type {
  LeaderboardResponse,
  SubjectLeaderboardResponse,
  PeriodLeaderboardResponse,
  UserRank,
  LeaderboardSettings,
  LeaderboardEntry,
} from '../types/leaderboard.types';

export const leaderboardApi = {
  /**
   * Get overall class leaderboard
   */
  getClassLeaderboard: (classNum: number, limit = 20, offset = 0) => {
    return apiClient.get<LeaderboardResponse>(
      `/api/leaderboard/${classNum}?limit=${limit}&offset=${offset}`
    );
  },

  /**
   * Get top performers (quick view - default 3)
   */
  getTopPerformers: (classNum: number, limit = 3) => {
    return apiClient.get<LeaderboardEntry[]>(
      `/api/leaderboard/${classNum}/top?limit=${limit}`
    );
  },

  /**
   * Get weekly leaderboard (current week)
   */
  getWeeklyLeaderboard: (classNum: number, limit = 20) => {
    return apiClient.get<PeriodLeaderboardResponse>(
      `/api/leaderboard/${classNum}/weekly?limit=${limit}`
    );
  },

  /**
   * Get monthly leaderboard (current month)
   */
  getMonthlyLeaderboard: (classNum: number, limit = 20) => {
    return apiClient.get<PeriodLeaderboardResponse>(
      `/api/leaderboard/${classNum}/monthly?limit=${limit}`
    );
  },

  /**
   * Get subject-specific leaderboard
   */
  getSubjectLeaderboard: (classNum: number, subject: string, limit = 20) => {
    return apiClient.get<SubjectLeaderboardResponse>(
      `/api/leaderboard/${classNum}/subject/${encodeURIComponent(subject)}?limit=${limit}`
    );
  },

  /**
   * Get current user's rank
   */
  getMyRank: () => {
    return apiClient.get<UserRank>('/api/leaderboard/my-rank');
  },

  /**
   * Update leaderboard settings (privacy, display name)
   */
  updateSettings: (settings: LeaderboardSettings) => {
    return apiClient.patch<{ message: string }>('/api/leaderboard/settings', settings);
  },

  /**
   * Refresh rankings (triggers recalculation)
   */
  refreshRankings: () => {
    return apiClient.post<{ message: string }>('/api/leaderboard/refresh');
  },
};
