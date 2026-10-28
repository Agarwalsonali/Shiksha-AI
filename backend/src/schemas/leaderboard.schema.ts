import { z } from 'zod';

/**
 * Get class leaderboard
 * GET /api/leaderboard/:class
 */
export const getLeaderboardSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
});

export const getLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetLeaderboardInput = z.infer<typeof getLeaderboardSchema>;
export type GetLeaderboardQueryInput = z.infer<typeof getLeaderboardQuerySchema>;

/**
 * Get user's rank
 * GET /api/leaderboard/my-rank
 */
export const getMyRankSchema = z.object({});

/**
 * Get top performers
 * GET /api/leaderboard/:class/top
 */
export const getTopPerformersSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
});

export const getTopPerformersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

export type GetTopPerformersInput = z.infer<typeof getTopPerformersSchema>;
export type GetTopPerformersQueryInput = z.infer<typeof getTopPerformersQuerySchema>;

/**
 * Update privacy settings
 * PATCH /api/leaderboard/settings
 */
export const updateSettingsSchema = z.object({
  show_on_leaderboard: z.boolean().optional(),
  display_name: z.string().min(2).max(30).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Get subject leaderboard
 * GET /api/leaderboard/:class/subject/:subject
 */
export const getSubjectLeaderboardSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
  subject: z.string().min(1),
});

export const getSubjectLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetSubjectLeaderboardInput = z.infer<typeof getSubjectLeaderboardSchema>;
export type GetSubjectLeaderboardQueryInput = z.infer<typeof getSubjectLeaderboardQuerySchema>;

/**
 * Get weekly leaderboard
 * GET /api/leaderboard/:class/weekly
 */
export const getWeeklyLeaderboardSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
});

export const getWeeklyLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetWeeklyLeaderboardInput = z.infer<typeof getWeeklyLeaderboardSchema>;
export type GetWeeklyLeaderboardQueryInput = z.infer<typeof getWeeklyLeaderboardQuerySchema>;

/**
 * Get monthly leaderboard
 * GET /api/leaderboard/:class/monthly
 */
export const getMonthlyLeaderboardSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
});

export const getMonthlyLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetMonthlyLeaderboardInput = z.infer<typeof getMonthlyLeaderboardSchema>;
export type GetMonthlyLeaderboardQueryInput = z.infer<typeof getMonthlyLeaderboardQuerySchema>;
