import { z } from 'zod';

/**
 * Bloom's Taxonomy Level Schema
 */
export const bloomLevelSchema = z.enum([
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
]);

export type BloomLevel = z.infer<typeof bloomLevelSchema>;

/**
 * Get IQ Level Schema
 * GET /api/intelligence/iq
 */
export const getIQLevelSchema = z.object({});

/**
 * Get Knowledge Levels Schema
 * GET /api/intelligence/knowledge
 */
export const getKnowledgeLevelsSchema = z.object({
  subject: z.string().optional(),
});

export type GetKnowledgeLevelsInput = z.infer<typeof getKnowledgeLevelsSchema>;

/**
 * Get Evaluation History Schema
 * GET /api/intelligence/history
 */
export const getEvaluationHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GetEvaluationHistoryInput = z.infer<typeof getEvaluationHistorySchema>;

/**
 * Recalculate IQ Schema
 * POST /api/intelligence/recalculate
 */
export const recalculateIQSchema = z.object({});

/**
 * Tutor Evaluation Schema
 * Used by the AI tutor tool to evaluate user questions
 */
export const tutorEvaluationSchema = z.object({
  bloom_level: bloomLevelSchema,
  question_complexity: z.number().int().min(1).max(10),
  demonstrates_understanding: z.boolean(),
  reasoning_quality: z.number().int().min(1).max(10),
  subject: z.string().optional(),
  topic: z.string().optional(),
  chapter: z.string().optional(),
});

export type TutorEvaluationInput = z.infer<typeof tutorEvaluationSchema>;

/**
 * IQ Level Response
 */
export const iqLevelResponseSchema = z.object({
  iq_score: z.number(),
  logical_reasoning: z.number(),
  problem_solving: z.number(),
  conceptual_understanding: z.number(),
  analytical_thinking: z.number(),
  memory_retention: z.number(),
  confidence: z.number(),
  evaluation_count: z.number(),
});

/**
 * Knowledge Level Response
 */
export const knowledgeLevelResponseSchema = z.object({
  class: z.number(),
  subject: z.string(),
  knowledge_score: z.number(),
  remember_level: z.number(),
  understand_level: z.number(),
  apply_level: z.number(),
  analyze_level: z.number(),
  evaluate_level: z.number(),
  create_level: z.number(),
  quiz_data_points: z.number(),
  tutor_data_points: z.number(),
});

/**
 * Evaluation Record Response
 */
export const evaluationRecordSchema = z.object({
  id: z.string(),
  source: z.enum(['quiz', 'tutor', 'manual']),
  source_id: z.string().optional(),
  subject: z.string().optional(),
  evaluation_type: z.string(),
  previous_iq: z.number().optional(),
  new_iq: z.number().optional(),
  iq_delta: z.number().optional(),
  previous_knowledge: z.number().optional(),
  new_knowledge: z.number().optional(),
  knowledge_delta: z.number().optional(),
  bloom_level: bloomLevelSchema.optional(),
  question_complexity: z.number().optional(),
  reasoning: z.string().optional(),
  created_at: z.string(),
});
