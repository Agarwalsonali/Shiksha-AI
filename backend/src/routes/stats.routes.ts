import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  getOverviewSchema,
  getTopicStatsSchema,
  getQuizPerformanceSchema,
  getStudyActivitySchema,
  getStreaksSchema,
  getRecommendationsSchema,
} from '../schemas/stats.schema';
import * as statsController from '../controllers/stats.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/stats/overview - Overall statistics
router.get('/overview', validate(getOverviewSchema, 'query'), asyncHandler(statsController.getOverview));

// GET /api/stats/topics - Topic-wise performance
router.get('/topics', validate(getTopicStatsSchema, 'query'), asyncHandler(statsController.getTopicStats));

// GET /api/stats/quiz-performance - Quiz performance over time
router.get('/quiz-performance', validate(getQuizPerformanceSchema, 'query'), asyncHandler(statsController.getQuizPerformance));

// GET /api/stats/activity - Study activity timeline
router.get('/activity', validate(getStudyActivitySchema, 'query'), asyncHandler(statsController.getStudyActivity));

// GET /api/stats/streaks - Study streaks
router.get('/streaks', asyncHandler(statsController.getStreaks));

// GET /api/stats/recommendations - Personalized recommendations
router.get('/recommendations', validate(getRecommendationsSchema, 'query'), asyncHandler(statsController.getRecommendations));

export default router;
