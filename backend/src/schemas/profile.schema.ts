import { z } from 'zod';

/**
 * Schema for updating user profile
 * All fields are optional since this is a PATCH operation
 */
export const updateProfileSchema = z.object({
  class: z.number().int().min(6).max(12).optional(),
  board: z.string().min(1).optional(),
  subjects: z.array(z.string()).min(1, 'At least one subject required').optional(),
  weak_topics: z.array(z.string()).optional(),
  strong_topics: z.array(z.string()).optional(),
  target_exams: z.array(z.string()).optional(),
  daily_study_hours: z.number().int().min(1).max(12).optional(),
  timezone: z.string().optional(),
});

/**
 * Schema for adding/removing topics from weak/strong lists
 */
export const updateTopicsSchema = z.object({
  weak_topics: z.object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  }).optional(),
  strong_topics: z.object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * TypeScript types inferred from schemas
 */
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateTopicsInput = z.infer<typeof updateTopicsSchema>;
