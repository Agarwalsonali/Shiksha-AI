import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { askQuestionSchema, getSessionSchema, listSessionsSchema, deleteSessionSchema } from '../schemas/tutor.schema';
import * as tutorController from '../controllers/tutor.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/tutor/ask - Stream answer to question (RAG + LLM)
router.post('/ask', validate(askQuestionSchema), asyncHandler(tutorController.askQuestion));

// GET /api/tutor/sessions - List all sessions for user (with pagination)
router.get('/sessions', validate(listSessionsSchema, 'query'), asyncHandler(tutorController.listSessions));

// GET /api/tutor/session/:session_id - Get session with messages
router.get('/session/:session_id', validate(getSessionSchema, 'params'), asyncHandler(tutorController.getSession));

// DELETE /api/tutor/session/:session_id - Delete session
router.delete('/session/:session_id', validate(deleteSessionSchema, 'params'), asyncHandler(tutorController.deleteSession));

export default router;
