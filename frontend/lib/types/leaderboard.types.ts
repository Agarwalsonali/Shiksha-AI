/**
 * Leaderboard Types
 * Types for class rankings and leaderboard data
 */

// Base leaderboard entry (overall ranking)
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  score: number;
  progress_percent: number;
  quiz_avg: number;
  streak: number;
  badges_count: number;
  total_xp: number;
}

// Subject-specific leaderboard entry
export interface SubjectLeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  score: number;
  quiz_avg: number;
  quiz_count: number;
  chapters_completed: number;
  chapters_total: number;
  progress_percent: number;
}

// Period-based leaderboard entry (weekly/monthly)
export interface PeriodLeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  score: number;
  quiz_count: number;
  quiz_avg: number;
  perfect_quizzes: number;
  chapters_completed: number;
  total_xp_earned: number;
}

// User's rank information
export interface UserRank {
  rank: number | null;
  total_users: number;
  percentile: number;
  score: number;
}

// Overall leaderboard response
export interface LeaderboardResponse {
  class: number;
  leaderboard: LeaderboardEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  updated_at: string | null;
}

// Subject leaderboard response
export interface SubjectLeaderboardResponse {
  class: number;
  subject: string;
  leaderboard: SubjectLeaderboardEntry[];
}

// Period leaderboard response (weekly/monthly)
export interface PeriodLeaderboardResponse {
  class: number;
  period: string;
  period_start: string;
  period_end: string;
  leaderboard: PeriodLeaderboardEntry[];
  total: number;
}

// Leaderboard settings
export interface LeaderboardSettings {
  show_on_leaderboard: boolean;
  display_name?: string;
}

// Leaderboard type enum
export type LeaderboardType = 'overall' | 'weekly' | 'monthly' | 'subject';

// Leaderboard tab configuration
export interface LeaderboardTab {
  id: LeaderboardType;
  label: string;
  description: string;
}
