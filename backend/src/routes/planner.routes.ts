import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  generatePlanSchema,
  getPlanSchema,
  updateTaskStatusBodySchema,
  listPlansSchema,
  getProgressSchema,
  deletePlanSchema,
  generateChapterPlanSchema,
  getChapterPlanSchema,
  updateChapterTaskBodySchema,
  getPlansByDeadlineSchema,
  getTodayTasksSchema,
  generateTopicPlanSchema,
  getAllPlansSchema,
} from '../schemas/planner.schema';
import * as plannerController from '../controllers/planner.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/planner/generate - Generate AI study plan
router.post('/generate', validate(generatePlanSchema), asyncHandler(plannerController.generatePlan));

// GET /api/planner/plan - Get plan for specific date (or today)
router.get('/plan', validate(getPlanSchema, 'query'), asyncHandler(plannerController.getPlan));

// GET /api/planner/plans - List all study plans
router.get('/plans', validate(listPlansSchema, 'query'), asyncHandler(plannerController.listPlans));

// GET /api/planner/progress - Get study plan progress
router.get('/progress', validate(getProgressSchema, 'query'), asyncHandler(plannerController.getProgress));

// PATCH /api/planner/task/:task_id - Update task status
router.patch('/task/:task_id', validate(updateTaskStatusBodySchema), asyncHandler(plannerController.updateTaskStatus));

// DELETE /api/planner/plan/:plan_id - Delete study plan
router.delete('/plan/:plan_id', validate(deletePlanSchema, 'params'), asyncHandler(plannerController.deletePlan));

// =============================================================================
// CHAPTER-WISE PLANNING ROUTES
// =============================================================================

// POST /api/planner/generate-chapter-plan - Generate chapter-wise study plan
router.post('/generate-chapter-plan', validate(generateChapterPlanSchema), asyncHandler(plannerController.generateChapterPlan));

// GET /api/planner/chapter-plan/:plan_id - Get chapter plan details
router.get('/chapter-plan/:plan_id', validate(getChapterPlanSchema, 'params'), asyncHandler(plannerController.getChapterPlan));

// PATCH /api/planner/chapter-task/:task_id - Update chapter task status
router.patch('/chapter-task/:task_id', validate(updateChapterTaskBodySchema), asyncHandler(plannerController.updateChapterTask));

// GET /api/planner/by-deadline - Get plans filtered by deadline
router.get('/by-deadline', validate(getPlansByDeadlineSchema, 'query'), asyncHandler(plannerController.getPlansByDeadline));

// GET /api/planner/today - Get today's tasks across all plans
router.get('/today', validate(getTodayTasksSchema, 'query'), asyncHandler(plannerController.getTodayTasks));

// =============================================================================
// TOPIC-WISE PLANNING & NEW ROUTES
// =============================================================================

// POST /api/planner/generate-topic-plan - Generate topic-wise study plan for a chapter
router.post('/generate-topic-plan', validate(generateTopicPlanSchema), asyncHandler(plannerController.generateTopicPlan));

// GET /api/planner/streak - Get study streak data
router.get('/streak', asyncHandler(plannerController.getStreak));

// GET /api/planner/all - Get all plans grouped by subject
router.get('/all', validate(getAllPlansSchema, 'query'), asyncHandler(plannerController.getAllPlans));

// PATCH /api/planner/topic-task/:task_id - Update topic task with chapter completion check
router.patch('/topic-task/:task_id', validate(updateChapterTaskBodySchema), asyncHandler(plannerController.updateTopicTask));

export default router;
