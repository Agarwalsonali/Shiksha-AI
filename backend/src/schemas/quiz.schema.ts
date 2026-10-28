import { z } from 'zod';

/**
 * Generate Quiz Schema
 * POST /api/quiz/generate
 */
export const generateQuizSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  chapter: z.string().min(1, 'Chapter is required'),
  topic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  num_questions: z.number().int().min(1).max(20).default(5),
  question_type: z.enum(['mcq', 'true-false', 'fill-blank', 'short-answer']).optional(),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;

/**
 * Submit Quiz Attempt Schema
 * POST /api/quiz/attempt
 */
export const submitAttemptSchema = z.object({
  quiz_id: z.string().uuid('Invalid quiz ID'),
  answers: z.array(
    z.object({
      question_index: z.number().int().min(0),
      selected_answer: z.enum(['A', 'B', 'C', 'D']),
    })
  ).min(1, 'At least one answer is required'),
  time_taken_seconds: z.number().int().min(0).optional(),
});

export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

/**
 * Get Quiz Schema (Path Param)
 * GET /api/quiz/:quiz_id
 */
export const getQuizSchema = z.object({
  quiz_id: z.string().uuid('Invalid quiz ID'),
});

/**
 * List Quizzes Schema (Query Params)
 * GET /api/quiz/list
 */
export const listQuizzesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  subject: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

export type ListQuizzesInput = z.infer<typeof listQuizzesSchema>;

/**
 * Get Quiz Attempts Schema (Query Params)
 * GET /api/quiz/attempts/:quiz_id
 */
export const getQuizAttemptsSchema = z.object({
  quiz_id: z.string().uuid('Invalid quiz ID'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type GetQuizAttemptsInput = z.infer<typeof getQuizAttemptsSchema>;

/**
 * Delete Quiz Schema (Path Param)
 * DELETE /api/quiz/:quiz_id
 */
export const deleteQuizSchema = z.object({
  quiz_id: z.string().uuid('Invalid quiz ID'),
});
