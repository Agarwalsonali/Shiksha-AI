import { z } from 'zod';

/**
 * Answer modes for tutor responses
 * - simple: Easy language, everyday examples, conversational
 * - quick: Brief 2-3 sentences, key facts only
 * - detailed: Full explanation with examples, step-by-step
 * - exam: Exam-ready format, NCERT terminology, proper structure
 */
export const answerModeSchema = z.enum(['simple', 'quick', 'detailed', 'exam']);
export type AnswerMode = z.infer<typeof answerModeSchema>;

/**
 * Schema for asking a question (streaming endpoint)
 */
export const askQuestionSchema = z.object({
  session_id: z.string().uuid().optional(),
  question: z.string().min(1, 'Question is required').max(2000, 'Question too long'),
  answer_mode: answerModeSchema.default('simple'),
  subject: z.string().optional(), // Optional hint for better RAG search
  chapter: z.string().optional(), // Optional hint for better RAG search
});

/**
 * Schema for getting session history
 */
export const getSessionSchema = z.object({
  session_id: z.string().uuid(),
});

/**
 * Schema for listing user sessions (query params come as strings)
 */
export const listSessionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * Schema for deleting a session
 */
export const deleteSessionSchema = z.object({
  session_id: z.string().uuid(),
});

/**
 * TypeScript types inferred from schemas
 */
export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
export type GetSessionInput = z.infer<typeof getSessionSchema>;
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
export type DeleteSessionInput = z.infer<typeof deleteSessionSchema>;
