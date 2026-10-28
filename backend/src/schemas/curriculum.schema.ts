import { z } from 'zod';

/**
 * Get curriculum by class
 * GET /api/curriculum/:class
 */
export const getCurriculumSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
});

export type GetCurriculumInput = z.infer<typeof getCurriculumSchema>;

/**
 * Get subject by class and subject ID
 * GET /api/curriculum/:class/:subject
 */
export const getSubjectSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
  subject: z.string().min(1),
});

export type GetSubjectInput = z.infer<typeof getSubjectSchema>;

/**
 * Get chapter by ID
 * GET /api/curriculum/chapter/:chapter_id
 */
export const getChapterSchema = z.object({
  chapter_id: z.string().min(1),
});

export type GetChapterInput = z.infer<typeof getChapterSchema>;

/**
 * Search chapters
 * GET /api/curriculum/search
 */
export const searchChaptersSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  class: z.coerce.number().int().min(9).max(12).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchChaptersInput = z.infer<typeof searchChaptersSchema>;

/**
 * Get class statistics
 * GET /api/curriculum/:class/stats
 */
export const getClassStatsSchema = z.object({
  class: z.coerce.number().int().min(9).max(12),
});

export type GetClassStatsInput = z.infer<typeof getClassStatsSchema>;
