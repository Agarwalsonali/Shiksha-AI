import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  getLeaderboardSchema,
  getLeaderboardQuerySchema,
  getTopPerformersSchema,
  getTopPerformersQuerySchema,
  updateSettingsSchema,
  getSubjectLeaderboardSchema,
  getSubjectLeaderboardQuerySchema,
  getWeeklyLeaderboardSchema,
  getWeeklyLeaderboardQuerySchema,
  getMonthlyLeaderboardSchema,
  getMonthlyLeaderboardQuerySchema,
} from '../schemas/leaderboard.schema';
import * as leaderboardController from '../controllers/leaderboard.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/leaderboard/my-rank
 * Get current user's rank
 */
router.get('/my-rank', asyncHandler(leaderboardController.getMyRank));

/**
 * PATCH /api/leaderboard/settings
 * Update privacy settings
 */
router.patch(
  '/settings',
  validate(updateSettingsSchema),
  asyncHandler(leaderboardController.updateSettings)
);

/**
 * POST /api/leaderboard/refresh
 * Refresh user's stats
 */
router.post('/refresh', asyncHandler(leaderboardController.refreshStats));

/**
 * GET /api/leaderboard/:class/top
 * Get top performers for a class
 */
router.get(
  '/:class/top',
  validate(getTopPerformersSchema, 'params'),
  validate(getTopPerformersQuerySchema, 'query'),
  asyncHandler(leaderboardController.getTopPerformers)
);

/**
 * GET /api/leaderboard/:class/weekly
 * Get weekly leaderboard for a class
 */
router.get(
  '/:class/weekly',
  validate(getWeeklyLeaderboardSchema, 'params'),
  validate(getWeeklyLeaderboardQuerySchema, 'query'),
  asyncHandler(leaderboardController.getWeeklyLeaderboard)
);

/**
 * GET /api/leaderboard/:class/monthly
 * Get monthly leaderboard for a class
 */
router.get(
  '/:class/monthly',
  validate(getMonthlyLeaderboardSchema, 'params'),
  validate(getMonthlyLeaderboardQuerySchema, 'query'),
  asyncHandler(leaderboardController.getMonthlyLeaderboard)
);

/**
 * GET /api/leaderboard/:class/subject/:subject
 * Get subject-wise leaderboard
 */
router.get(
  '/:class/subject/:subject',
  validate(getSubjectLeaderboardSchema, 'params'),
  validate(getSubjectLeaderboardQuerySchema, 'query'),
  asyncHandler(leaderboardController.getSubjectLeaderboard)
);

/**
 * GET /api/leaderboard/:class
 * Get full leaderboard for a class
 */
router.get(
  '/:class',
  validate(getLeaderboardSchema, 'params'),
  validate(getLeaderboardQuerySchema, 'query'),
  asyncHandler(leaderboardController.getLeaderboard)
);

export default router;
