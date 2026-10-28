import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  getKnowledgeLevelsSchema,
  getEvaluationHistorySchema,
} from '../schemas/intelligence.schema';
import * as intelligenceController from '../controllers/intelligence.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/intelligence/summary - Get user-friendly cognitive summary (recommended for UI)
router.get('/summary', asyncHandler(intelligenceController.getIntelligenceSummary));

// GET /api/intelligence/iq - Get raw IQ level (internal/admin use)
router.get('/iq', asyncHandler(intelligenceController.getIQLevel));

// GET /api/intelligence/knowledge - Get knowledge levels by subject
router.get(
  '/knowledge',
  validate(getKnowledgeLevelsSchema, 'query'),
  asyncHandler(intelligenceController.getKnowledgeLevels)
);

// GET /api/intelligence/history - Get evaluation history
router.get(
  '/history',
  validate(getEvaluationHistorySchema, 'query'),
  asyncHandler(intelligenceController.getEvaluationHistory)
);

// POST /api/intelligence/recalculate - Force recalculation of IQ
router.post('/recalculate', asyncHandler(intelligenceController.recalculateIQ));

export default router;
