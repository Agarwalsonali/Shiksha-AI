import { z } from 'zod';

/**
 * Schema for user signup
 * Creates both auth user and profile in one transaction
 */
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  class: z.number().int().min(6).max(12, 'Class must be between 6 and 12'),
  board: z.string().default('CBSE'),
  subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  target_exams: z.array(z.string()).optional().default([]),
  daily_study_hours: z.number().int().min(1).max(12).optional().default(1),
});

/**
 * Schema for user login
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * TypeScript types inferred from schemas
 */
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
