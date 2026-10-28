import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/apiResponse';
import { DatabaseError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { gamificationService } from '../services/gamification.service';
import type {
  GetXPHistoryInput,
  GetAllBadgesInput,
  GetBadgeProgressInput,
} from '../schemas/gamification.schema';

/**
 * Get user's XP and level
 * GET /api/gamification/xp
 */
export const getUserXP = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Fetching user XP');

  try {
    const xp = await gamificationService.getUserXP(userId);

    // Calculate progress to next level as percentage
    const levelProgressPercent = xp.xp_to_next_level > 0
      ? Math.round((xp.xp_in_current_level / (xp.xp_in_current_level + xp.xp_to_next_level)) * 100)
      : 100;

    res.json(
      successResponse({
        total_xp: xp.total_xp,
        level: xp.level,
        xp_to_next_level: xp.xp_to_next_level,
        xp_in_current_level: xp.xp_in_current_level,
        level_progress_percent: levelProgressPercent,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user XP');
    throw new DatabaseError('Failed to get XP data');
  }
};

/**
 * Get XP transaction history
 * GET /api/gamification/xp/history
 */
export const getXPHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { limit, offset } = req.query as unknown as GetXPHistoryInput;

  logger.info({ userId, limit, offset }, 'Fetching XP history');

  try {
    const { transactions, total } = await gamificationService.getXPHistory(userId, limit, offset);

    res.json(
      successResponse({
        transactions,
        pagination: {
          limit,
          offset,
          total,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get XP history');
    throw new DatabaseError('Failed to get XP history');
  }
};

/**
 * Get all available badges
 * GET /api/gamification/badges
 */
export const getAllBadges = async (req: AuthRequest, res: Response) => {
  const { category } = req.query as unknown as GetAllBadgesInput;

  logger.info({ category }, 'Fetching all badges');

  try {
    let badges = await gamificationService.getAllBadges();

    // Filter by category if specified
    if (category) {
      badges = badges.filter((b) => b.category === category);
    }

    // Group by category
    const byCategory: Record<string, typeof badges> = {};
    for (const badge of badges) {
      const categoryName = badge.category || 'other';
      if (!byCategory[categoryName]) {
        byCategory[categoryName] = [];
      }
      byCategory[categoryName].push(badge);
    }

    res.json(
      successResponse({
        total: badges.length,
        badges,
        by_category: byCategory,
      })
    );
  } catch (error) {
    logger.error({ error }, 'Failed to get all badges');
    throw new DatabaseError('Failed to get badges');
  }
};

/**
 * Get user's earned badges
 * GET /api/gamification/my-badges
 */
export const getUserBadges = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Fetching user badges');

  try {
    const badges = await gamificationService.getUserBadges(userId);

    // Group by category
    const byCategory: Record<string, typeof badges> = {};
    for (const badge of badges) {
      const category = badge.badge.category;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(badge);
    }

    res.json(
      successResponse({
        total_earned: badges.length,
        badges,
        by_category: byCategory,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user badges');
    throw new DatabaseError('Failed to get badges');
  }
};

/**
 * Get badge progress for user
 * GET /api/gamification/badge-progress
 */
export const getBadgeProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { category } = req.query as unknown as GetBadgeProgressInput;

  logger.info({ userId, category }, 'Fetching badge progress');

  try {
    let progress = await gamificationService.getBadgeProgress(userId);

    // Filter by category if specified
    if (category) {
      progress = progress.filter((p) => p.badge.category === category);
    }

    // Separate earned and unearned
    const earned = progress.filter((p) => p.earned);
    const inProgress = progress.filter((p) => !p.earned && p.progress > 0);
    const notStarted = progress.filter((p) => !p.earned && p.progress === 0);

    res.json(
      successResponse({
        total_badges: progress.length,
        earned_count: earned.length,
        in_progress_count: inProgress.length,
        not_started_count: notStarted.length,
        earned,
        in_progress: inProgress,
        not_started: notStarted,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get badge progress');
    throw new DatabaseError('Failed to get badge progress');
  }
};

/**
 * Check for new badges and award them
 * POST /api/gamification/check-badges
 */
export const checkBadges = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Checking for new badges');

  try {
    const newBadges = await gamificationService.checkAndAwardBadges(userId);

    res.json(
      successResponse({
        new_badges_count: newBadges.length,
        new_badges: newBadges,
        message: newBadges.length > 0 
          ? `Congratulations! You earned ${newBadges.length} new badge(s)!`
          : 'No new badges earned yet. Keep going!',
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to check badges');
    throw new DatabaseError('Failed to check badges');
  }
};

/**
 * Get gamification summary (XP, level, badges, streaks)
 * GET /api/gamification/summary
 */
export const getSummary = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Fetching gamification summary');

  try {
    // Get XP data
    const xp = await gamificationService.getUserXP(userId);

    // Get badges
    const badges = await gamificationService.getUserBadges(userId);

    // Get badge progress (for "next badge" feature)
    const progress = await gamificationService.getBadgeProgress(userId);
    const nearestBadge = progress
      .filter((p) => !p.earned)
      .sort((a, b) => b.progress - a.progress)[0];

    // Calculate level progress
    const levelProgressPercent = xp.xp_to_next_level > 0
      ? Math.round((xp.xp_in_current_level / (xp.xp_in_current_level + xp.xp_to_next_level)) * 100)
      : 100;

    res.json(
      successResponse({
        xp: {
          total: xp.total_xp,
          level: xp.level,
          to_next_level: xp.xp_to_next_level,
          level_progress_percent: levelProgressPercent,
        },
        badges: {
          total_earned: badges.length,
          recent: badges.slice(0, 3),
        },
        next_badge: nearestBadge
          ? {
              badge: nearestBadge.badge,
              progress: nearestBadge.progress,
              current: nearestBadge.current,
              required: nearestBadge.required,
            }
          : null,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get gamification summary');
    throw new DatabaseError('Failed to get summary');
  }
};
