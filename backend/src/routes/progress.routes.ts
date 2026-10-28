import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  getProgressSchema,
  getChapterProgressSchema,
  updateChapterProgressSchema,
  updateChapterProgressBodySchema,
  addTagSchema,
  addTagBodySchema,
  removeTagSchema,
  getProgressSummarySchema,
  bulkUpdateProgressSchema,
  getByTagSchema,
  getCurriculumWithProgressSchema,
} from '../schemas/progress.schema';
import * as progressController from '../controllers/progress.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/progress/curriculum
 * Get full curriculum with user progress (for Accordion UI)
 * Returns subjects with chapters, completion status, tags, descriptions
 */
router.get(
  '/curriculum',
  validate(getCurriculumWithProgressSchema, 'query'),
  asyncHandler(progressController.getCurriculumWithProgress)
);

/**
 * GET /api/progress/summary
 * Get progress summary for user
 */
router.get(
  '/summary',
  validate(getProgressSummarySchema, 'query'),
  asyncHandler(progressController.getProgressSummary)
);

/**
 * GET /api/progress/by-tag/:tag
 * Get chapters with a specific tag
 */
router.get(
  '/by-tag/:tag',
  validate(getByTagSchema, 'params'),
  asyncHandler(progressController.getByTag)
);

/**
 * POST /api/progress/bulk
 * Bulk update progress for multiple chapters
 */
router.post(
  '/bulk',
  validate(bulkUpdateProgressSchema),
  asyncHandler(progressController.bulkUpdateProgress)
);

/**
 * GET /api/progress/chapter/:chapter_id
 * Get progress for a specific chapter
 */
router.get(
  '/chapter/:chapter_id',
  validate(getChapterProgressSchema, 'params'),
  asyncHandler(progressController.getChapterProgress)
);

/**
 * PUT /api/progress/chapter/:chapter_id
 * Update progress for a chapter
 */
router.put(
  '/chapter/:chapter_id',
  validate(updateChapterProgressSchema, 'params'),
  validate(updateChapterProgressBodySchema),
  asyncHandler(progressController.updateChapterProgress)
);

/**
 * POST /api/progress/chapter/:chapter_id/tag
 * Add a tag to a chapter
 */
router.post(
  '/chapter/:chapter_id/tag',
  validate(addTagSchema, 'params'),
  validate(addTagBodySchema),
  asyncHandler(progressController.addTag)
);

/**
 * DELETE /api/progress/chapter/:chapter_id/tag/:tag
 * Remove a tag from a chapter
 */
router.delete(
  '/chapter/:chapter_id/tag/:tag',
  validate(removeTagSchema, 'params'),
  asyncHandler(progressController.removeTag)
);

/**
 * GET /api/progress
 * Get all chapter progress for user
 */
router.get(
  '/',
  validate(getProgressSchema, 'query'),
  asyncHandler(progressController.getProgress)
);

export default router;
