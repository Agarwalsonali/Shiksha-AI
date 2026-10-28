import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  getXPHistorySchema,
  getAllBadgesSchema,
  getBadgeProgressSchema,
} from '../schemas/gamification.schema';
import * as gamificationController from '../controllers/gamification.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/gamification/summary
 * Get gamification summary (XP, level, badges)
 */
router.get('/summary', asyncHandler(gamificationController.getSummary));

/**
 * GET /api/gamification/xp
 * Get user's XP and level
 */
router.get('/xp', asyncHandler(gamificationController.getUserXP));

/**
 * GET /api/gamification/xp/history
 * Get XP transaction history
 */
router.get(
  '/xp/history',
  validate(getXPHistorySchema, 'query'),
  asyncHandler(gamificationController.getXPHistory)
);

/**
 * GET /api/gamification/badges
 * Get all available badges
 */
router.get(
  '/badges',
  validate(getAllBadgesSchema, 'query'),
  asyncHandler(gamificationController.getAllBadges)
);

/**
 * GET /api/gamification/my-badges
 * Get user's earned badges
 */
router.get('/my-badges', asyncHandler(gamificationController.getUserBadges));

/**
 * GET /api/gamification/badge-progress
 * Get badge progress for user
 */
router.get(
  '/badge-progress',
  validate(getBadgeProgressSchema, 'query'),
  asyncHandler(gamificationController.getBadgeProgress)
);

/**
 * POST /api/gamification/check-badges
 * Check and award any new badges
 */
router.post('/check-badges', asyncHandler(gamificationController.checkBadges));

export default router;
