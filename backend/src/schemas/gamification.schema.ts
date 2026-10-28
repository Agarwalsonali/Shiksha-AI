import { z } from 'zod';

/**
 * Get user XP
 * GET /api/gamification/xp
 */
export const getUserXPSchema = z.object({});

/**
 * Get XP history
 * GET /api/gamification/xp/history
 */
export const getXPHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetXPHistoryInput = z.infer<typeof getXPHistorySchema>;

/**
 * Get all badges
 * GET /api/gamification/badges
 */
export const getAllBadgesSchema = z.object({
  category: z.string().optional(),
});

export type GetAllBadgesInput = z.infer<typeof getAllBadgesSchema>;

/**
 * Get user badges
 * GET /api/gamification/my-badges
 */
export const getUserBadgesSchema = z.object({});

/**
 * Get badge progress
 * GET /api/gamification/badge-progress
 */
export const getBadgeProgressSchema = z.object({
  category: z.string().optional(),
});

export type GetBadgeProgressInput = z.infer<typeof getBadgeProgressSchema>;

/**
 * Get gamification summary
 * GET /api/gamification/summary
 */
export const getGamificationSummarySchema = z.object({});
