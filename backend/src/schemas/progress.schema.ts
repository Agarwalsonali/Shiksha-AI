import { z } from 'zod';

// System tags enum values
const systemTagValues = [
  'need_revision',
  'important',
  'difficult',
  'easy',
  'exam_important',
  'completed',
] as const;

/**
 * Get all chapter progress
 * GET /api/progress
 */
export const getProgressSchema = z.object({
  subject: z.string().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  has_tag: z.string().optional(),
});

export type GetProgressInput = z.infer<typeof getProgressSchema>;

/**
 * Get progress for a specific chapter
 * GET /api/progress/chapter/:chapter_id
 */
export const getChapterProgressSchema = z.object({
  chapter_id: z.string().min(1),
});

export type GetChapterProgressInput = z.infer<typeof getChapterProgressSchema>;

/**
 * Update chapter progress
 * PUT /api/progress/chapter/:chapter_id
 */
export const updateChapterProgressSchema = z.object({
  // Path param
  chapter_id: z.string().min(1),
});

export const updateChapterProgressBodySchema = z.object({
  progress_percent: z.number().int().min(0).max(100).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  notes: z.string().max(2000).optional(),
  system_tags: z.array(z.enum(systemTagValues)).optional(),
  custom_tags: z.array(z.string().max(50)).max(10).optional(),
});

export type UpdateChapterProgressInput = z.infer<typeof updateChapterProgressBodySchema>;

/**
 * Add a tag to a chapter
 * POST /api/progress/chapter/:chapter_id/tag
 */
export const addTagSchema = z.object({
  chapter_id: z.string().min(1),
});

export const addTagBodySchema = z.object({
  tag: z.string().min(1).max(50),
  type: z.enum(['system', 'custom']).default('custom'),
});

export type AddTagInput = z.infer<typeof addTagBodySchema>;

/**
 * Remove a tag from a chapter
 * DELETE /api/progress/chapter/:chapter_id/tag/:tag
 */
export const removeTagSchema = z.object({
  chapter_id: z.string().min(1),
  tag: z.string().min(1),
});

export type RemoveTagInput = z.infer<typeof removeTagSchema>;

/**
 * Get progress summary
 * GET /api/progress/summary
 */
export const getProgressSummarySchema = z.object({
  subject: z.string().optional(),
});

export type GetProgressSummaryInput = z.infer<typeof getProgressSummarySchema>;

/**
 * Bulk update progress (for multiple chapters)
 * POST /api/progress/bulk
 */
export const bulkUpdateProgressSchema = z.object({
  updates: z.array(
    z.object({
      chapter_id: z.string().min(1),
      progress_percent: z.number().int().min(0).max(100).optional(),
      status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
    })
  ).min(1).max(50),
});

export type BulkUpdateProgressInput = z.infer<typeof bulkUpdateProgressSchema>;

/**
 * Get chapters by tag
 * GET /api/progress/by-tag/:tag
 */
export const getByTagSchema = z.object({
  tag: z.string().min(1),
});

export type GetByTagInput = z.infer<typeof getByTagSchema>;

/**
 * Get full curriculum with progress (for Accordion UI)
 * GET /api/progress/curriculum
 */
export const getCurriculumWithProgressSchema = z.object({
  subject: z.string().optional(), // Filter by specific subject
});

export type GetCurriculumWithProgressInput = z.infer<typeof getCurriculumWithProgressSchema>;
