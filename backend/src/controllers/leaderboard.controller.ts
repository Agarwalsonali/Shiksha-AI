import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse } from '../utils/apiResponse';
import { ValidationError, DatabaseError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { leaderboardService } from '../services/leaderboard.service';
import type {
  GetLeaderboardInput,
  GetLeaderboardQueryInput,
  GetTopPerformersInput,
  GetTopPerformersQueryInput,
  UpdateSettingsInput,
  GetSubjectLeaderboardInput,
  GetSubjectLeaderboardQueryInput,
  GetWeeklyLeaderboardInput,
  GetWeeklyLeaderboardQueryInput,
  GetMonthlyLeaderboardInput,
  GetMonthlyLeaderboardQueryInput,
} from '../schemas/leaderboard.schema';

/**
 * Get class leaderboard
 * GET /api/leaderboard/:class
 */
export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  const { class: classNum } = req.params as unknown as GetLeaderboardInput;
  const { limit, offset } = req.query as unknown as GetLeaderboardQueryInput;

  logger.info({ classNum, limit, offset }, 'Fetching leaderboard');

  try {
    const { entries, total, updatedAt } = await leaderboardService.getClassLeaderboard(
      classNum,
      limit,
      offset
    );

    res.json(
      successResponse({
        class: classNum,
        leaderboard: entries,
        pagination: {
          limit,
          offset,
          total,
        },
        updated_at: updatedAt,
      })
    );
  } catch (error) {
    logger.error({ error, classNum }, 'Failed to get leaderboard');
    throw new DatabaseError('Failed to get leaderboard');
  }
};

/**
 * Get user's rank
 * GET /api/leaderboard/my-rank
 */
export const getMyRank = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Fetching user rank');

  try {
    // Get user profile to know their class
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class, display_name, show_on_leaderboard')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found');
    }

    const rank = await leaderboardService.getUserRank(userId, profile.class);

    res.json(
      successResponse({
        class: profile.class,
        rank: rank.rank,
        total_users: rank.total_users,
        percentile: rank.percentile,
        score: rank.score,
        settings: {
          show_on_leaderboard: profile.show_on_leaderboard,
          display_name: profile.display_name,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user rank');
    if (error instanceof ValidationError) throw error;
    throw new DatabaseError('Failed to get rank');
  }
};

/**
 * Get top performers
 * GET /api/leaderboard/:class/top
 */
export const getTopPerformers = async (req: AuthRequest, res: Response) => {
  const { class: classNum } = req.params as unknown as GetTopPerformersInput;
  const { limit } = req.query as unknown as GetTopPerformersQueryInput;

  logger.info({ classNum, limit }, 'Fetching top performers');

  try {
    const topPerformers = await leaderboardService.getTopPerformers(classNum, limit);

    res.json(
      successResponse({
        class: classNum,
        top_performers: topPerformers,
      })
    );
  } catch (error) {
    logger.error({ error, classNum }, 'Failed to get top performers');
    throw new DatabaseError('Failed to get top performers');
  }
};

/**
 * Update privacy settings
 * PATCH /api/leaderboard/settings
 */
export const updateSettings = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const updates = req.body as UpdateSettingsInput;

  logger.info({ userId, updates }, 'Updating leaderboard settings');

  try {
    await leaderboardService.updatePrivacySetting(
      userId,
      updates.show_on_leaderboard ?? true,
      updates.display_name
    );

    // Fetch updated settings
    const { data: profile } = await supabase
      .from('user_profile')
      .select('show_on_leaderboard, display_name')
      .eq('user_id', userId)
      .single();

    res.json(
      successResponse({
        settings: {
          show_on_leaderboard: profile?.show_on_leaderboard,
          display_name: profile?.display_name,
        },
        message: 'Settings updated successfully',
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to update settings');
    throw new DatabaseError('Failed to update settings');
  }
};

/**
 * Get subject leaderboard
 * GET /api/leaderboard/:class/subject/:subject
 */
export const getSubjectLeaderboard = async (req: AuthRequest, res: Response) => {
  const { class: classNum, subject } = req.params as unknown as GetSubjectLeaderboardInput;
  const { limit } = req.query as unknown as GetSubjectLeaderboardQueryInput;

  logger.info({ classNum, subject, limit }, 'Fetching subject leaderboard');

  try {
    const entries = await leaderboardService.getSubjectLeaderboard(classNum, subject, limit);

    res.json(
      successResponse({
        class: classNum,
        subject,
        leaderboard: entries,
      })
    );
  } catch (error) {
    logger.error({ error, classNum, subject }, 'Failed to get subject leaderboard');
    throw new DatabaseError('Failed to get subject leaderboard');
  }
};

/**
 * Refresh user's stats (trigger recalculation)
 * POST /api/leaderboard/refresh
 */
export const refreshStats = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Refreshing user stats');

  try {
    // Get user's class
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found');
    }

    // Update user stats
    await leaderboardService.updateUserStats(userId, profile.class);

    // Get updated rank
    const rank = await leaderboardService.getUserRank(userId, profile.class);

    res.json(
      successResponse({
        message: 'Stats refreshed successfully',
        rank: rank.rank,
        score: rank.score,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to refresh stats');
    if (error instanceof ValidationError) throw error;
    throw new DatabaseError('Failed to refresh stats');
  }
};

/**
 * Get weekly leaderboard
 * GET /api/leaderboard/:class/weekly
 */
export const getWeeklyLeaderboard = async (req: AuthRequest, res: Response) => {
  const { class: classNum } = req.params as unknown as GetWeeklyLeaderboardInput;
  const { limit } = req.query as unknown as GetWeeklyLeaderboardQueryInput;

  logger.info({ classNum, limit }, 'Fetching weekly leaderboard');

  try {
    const { entries, period_start, period_end } = await leaderboardService.getWeeklyLeaderboard(
      classNum,
      limit
    );

    res.json(
      successResponse({
        class: classNum,
        period: 'weekly',
        period_start,
        period_end,
        leaderboard: entries,
        total: entries.length,
      })
    );
  } catch (error) {
    logger.error({ error, classNum }, 'Failed to get weekly leaderboard');
    throw new DatabaseError('Failed to get weekly leaderboard');
  }
};

/**
 * Get monthly leaderboard
 * GET /api/leaderboard/:class/monthly
 */
export const getMonthlyLeaderboard = async (req: AuthRequest, res: Response) => {
  const { class: classNum } = req.params as unknown as GetMonthlyLeaderboardInput;
  const { limit } = req.query as unknown as GetMonthlyLeaderboardQueryInput;

  logger.info({ classNum, limit }, 'Fetching monthly leaderboard');

  try {
    const { entries, period_start, period_end } = await leaderboardService.getMonthlyLeaderboard(
      classNum,
      limit
    );

    res.json(
      successResponse({
        class: classNum,
        period: 'monthly',
        period_start,
        period_end,
        leaderboard: entries,
        total: entries.length,
      })
    );
  } catch (error) {
    logger.error({ error, classNum }, 'Failed to get monthly leaderboard');
    throw new DatabaseError('Failed to get monthly leaderboard');
  }
};
