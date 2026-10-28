import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { updateProfileSchema, updateTopicsSchema } from '../schemas/profile.schema';
import * as profileController from '../controllers/profile.controller';

const router = Router();

// All profile routes require authentication
router.use(authenticate);

/**
 * GET /api/profile
 * Get user profile
 */
router.get('/', asyncHandler(profileController.getProfile));

/**
 * GET /api/profile/full
 * Get full user profile with user data
 */
router.get('/full', asyncHandler(profileController.getFullProfile));

/**
 * PATCH /api/profile
 * Update user profile (class, board, subjects, etc.)
 */
router.patch(
  '/',
  validate(updateProfileSchema),
  asyncHandler(profileController.updateProfile)
);

/**
 * PATCH /api/profile/topics
 * Add or remove weak/strong topics
 */
router.patch(
  '/topics',
  validate(updateTopicsSchema),
  asyncHandler(profileController.updateTopics)
);

export default router;
