import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { signupSchema, loginSchema } from '../schemas/auth.schema';
import * as authController from '../controllers/auth.controller';

const router = Router();

/**
 * POST /api/auth/signup
 * Create new user account with profile
 * Public route
 */
router.post('/signup', validate(signupSchema), asyncHandler(authController.signup));

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 * Public route
 */
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

/**
 * POST /api/auth/logout
 * Sign out current user
 * Public route (token optional)
 */
router.post('/logout', asyncHandler(authController.logout));

/**
 * GET /api/auth/me
 * Get current authenticated user with profile
 * Protected route - requires valid JWT token
 */
router.get('/me', authenticate, asyncHandler(authController.getUser));

export default router;
