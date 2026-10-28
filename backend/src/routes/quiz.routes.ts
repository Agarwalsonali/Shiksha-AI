import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  generateQuizSchema,
  submitAttemptSchema,
  getQuizSchema,
  listQuizzesSchema,
  getQuizAttemptsSchema,
  deleteQuizSchema,
} from '../schemas/quiz.schema';
import * as quizController from '../controllers/quiz.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/quiz/generate - Generate new quiz with AI
router.post('/generate', validate(generateQuizSchema), asyncHandler(quizController.generateQuiz));

// POST /api/quiz/attempt - Submit quiz attempt and get results
router.post('/attempt', validate(submitAttemptSchema), asyncHandler(quizController.submitAttempt));

// GET /api/quiz/list - List user's quizzes with filters
router.get('/list', validate(listQuizzesSchema, 'query'), asyncHandler(quizController.listQuizzes));

// GET /api/quiz/:quiz_id - Get specific quiz (for review/retry)
router.get('/:quiz_id', validate(getQuizSchema, 'params'), asyncHandler(quizController.getQuiz));

// GET /api/quiz/attempts/:quiz_id - Get quiz attempt history
router.get('/attempts/:quiz_id', validate(getQuizAttemptsSchema, 'params'), asyncHandler(quizController.getQuizAttempts));

// DELETE /api/quiz/:quiz_id - Delete quiz
router.delete('/:quiz_id', validate(deleteQuizSchema, 'params'), asyncHandler(quizController.deleteQuiz));

export default router;
