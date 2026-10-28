import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { optionalAuth } from '../middleware/auth';
import {
  getCurriculumSchema,
  getSubjectSchema,
  getChapterSchema,
  searchChaptersSchema,
  getClassStatsSchema,
} from '../schemas/curriculum.schema';
import * as curriculumController from '../controllers/curriculum.controller';

const router = Router();

// Optional auth for all routes (curriculum is public but can be personalized)
router.use(optionalAuth);

/**
 * GET /api/curriculum/classes
 * Get list of supported classes
 */
router.get('/classes', asyncHandler(curriculumController.getSupportedClasses));

/**
 * GET /api/curriculum/search
 * Search chapters across all classes
 */
router.get(
  '/search',
  validate(searchChaptersSchema, 'query'),
  asyncHandler(curriculumController.searchCurriculum)
);

/**
 * GET /api/curriculum/chapter/:chapter_id
 * Get chapter details by ID
 */
router.get(
  '/chapter/:chapter_id',
  validate(getChapterSchema, 'params'),
  asyncHandler(curriculumController.getChapterDetails)
);

/**
 * GET /api/curriculum/:class/stats
 * Get statistics for a class
 */
router.get(
  '/:class/stats',
  validate(getClassStatsSchema, 'params'),
  asyncHandler(curriculumController.getStats)
);

/**
 * GET /api/curriculum/:class/:subject
 * Get subject details with chapters
 */
router.get(
  '/:class/:subject',
  validate(getSubjectSchema, 'params'),
  asyncHandler(curriculumController.getSubjectDetails)
);

/**
 * GET /api/curriculum/:class
 * Get full curriculum for a class
 */
router.get(
  '/:class',
  validate(getCurriculumSchema, 'params'),
  asyncHandler(curriculumController.getCurriculum)
);

export default router;
