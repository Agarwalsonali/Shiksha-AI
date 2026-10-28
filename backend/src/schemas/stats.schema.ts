import { z } from 'zod';

/**
 * Get Overview Stats Schema
 * GET /api/stats/overview
 */
export const getOverviewSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30), // Last N days
});

export type GetOverviewInput = z.infer<typeof getOverviewSchema>;

/**
 * Get Topic Stats Schema
 * GET /api/stats/topics
 */
export const getTopicStatsSchema = z.object({
  subject: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type GetTopicStatsInput = z.infer<typeof getTopicStatsSchema>;

/**
 * Get Quiz Performance Schema
 * GET /api/stats/quiz-performance
 */
export const getQuizPerformanceSchema = z.object({
  subject: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type GetQuizPerformanceInput = z.infer<typeof getQuizPerformanceSchema>;

/**
 * Get Study Activity Schema
 * GET /api/stats/activity
 */
export const getStudyActivitySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  activity_type: z.enum(['chat', 'quiz_attempt', 'plan_task_completed']).optional(),
});

export type GetStudyActivityInput = z.infer<typeof getStudyActivitySchema>;

/**
 * Get Streaks Schema
 * GET /api/stats/streaks
 */
export const getStreaksSchema = z.object({
  // No params needed
});

export type GetStreaksInput = z.infer<typeof getStreaksSchema>;

/**
 * Get Recommendations Schema
 * GET /api/stats/recommendations
 */
export const getRecommendationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export type GetRecommendationsInput = z.infer<typeof getRecommendationsSchema>;
