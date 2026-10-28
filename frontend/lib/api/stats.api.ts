/**
 * Stats API Service
 * Handles user statistics and activity data
 */

import { apiClient } from './client';

export interface OverviewStats {
  period_days: number;
  total_quizzes: number;
  avg_quiz_score: number;
  tutor_sessions: number;
  study_plans_created: number;
  tasks_completed: number;
  total_study_hours: number;
  weak_topics_count: number;
  strong_topics_count: number;
}

export interface StreakStats {
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
}

export interface TopicStat {
  topic: string;
  attempts: number;
  avg_score: number;
  is_weak: boolean;
  is_strong: boolean;
}

export const statsApi = {
  /**
   * Get overview statistics
   */
  getOverview: (days = 30) => {
    return apiClient.get<{ overview: OverviewStats }>(`/api/stats/overview?days=${days}`);
  },

  /**
   * Get streak statistics
   */
  getStreaks: () => {
    return apiClient.get<{ streaks: StreakStats }>('/api/stats/streaks');
  },

  /**
   * Get topic statistics (sorted by weakest first)
   */
  getTopicStats: (subject?: string, limit = 10) => {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    params.append('limit', limit.toString());
    return apiClient.get<{ topics: TopicStat[] }>(`/api/stats/topics?${params}`);
  },
};
