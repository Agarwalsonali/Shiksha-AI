/**
 * Intelligence & IQ Types
 * Types for cognitive ability tracking and Bloom's taxonomy evaluation
 */

// Bloom's taxonomy levels
export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

// Bloom level display info
export const BLOOM_LEVELS: Record<BloomLevel, { label: string; description: string; color: string }> = {
  remember: {
    label: 'Remember',
    description: 'Recall facts and basic concepts',
    color: '#EF4444', // red
  },
  understand: {
    label: 'Understand',
    description: 'Explain ideas or concepts',
    color: '#F97316', // orange
  },
  apply: {
    label: 'Apply',
    description: 'Use information in new situations',
    color: '#EAB308', // yellow
  },
  analyze: {
    label: 'Analyze',
    description: 'Draw connections among ideas',
    color: '#22C55E', // green
  },
  evaluate: {
    label: 'Evaluate',
    description: 'Justify a decision or course of action',
    color: '#3B82F6', // blue
  },
  create: {
    label: 'Create',
    description: 'Produce new or original work',
    color: '#8B5CF6', // purple
  },
};

// IQ Level response
export interface IQLevel {
  iq_score: number;
  logical_reasoning: number;
  problem_solving: number;
  conceptual_understanding: number;
  analytical_thinking: number;
  memory_retention: number;
  confidence: number;
  evaluation_count: number;
}

// Knowledge level for a subject
export interface KnowledgeLevel {
  class: number;
  subject: string;
  knowledge_score: number;
  remember_level: number;
  understand_level: number;
  apply_level: number;
  analyze_level: number;
  evaluate_level: number;
  create_level: number;
  quiz_data_points: number;
  tutor_data_points: number;
}

// Evaluation history record
export interface EvaluationRecord {
  id: string;
  source: 'quiz' | 'tutor' | 'manual';
  source_id?: string;
  subject?: string;
  evaluation_type: string;
  previous_iq?: number;
  new_iq?: number;
  iq_delta?: number;
  previous_knowledge?: number;
  new_knowledge?: number;
  knowledge_delta?: number;
  bloom_level?: BloomLevel;
  question_complexity?: number;
  reasoning?: string;
  created_at: string;
}

// Intelligence summary (user-friendly combined data)
export interface IntelligenceSummary {
  iq: IQLevel | null;
  knowledge: KnowledgeLevel[];
  recent_evaluations: EvaluationRecord[];
  // Derived stats
  total_evaluations: number;
  strongest_subject: string | null;
  weakest_subject: string | null;
  average_bloom_level: BloomLevel | null;
  last_evaluated_at: string | null;
}

// Cognitive profile (for display)
export interface CognitiveProfile {
  // Overall IQ
  iq_score: number;
  iq_category: 'below_average' | 'average' | 'above_average' | 'high' | 'very_high' | 'exceptional';
  // Cognitive dimensions (0-100 scale)
  dimensions: {
    logical_reasoning: number;
    problem_solving: number;
    conceptual_understanding: number;
    analytical_thinking: number;
    memory_retention: number;
  };
  // Confidence in the assessment
  confidence_percent: number;
  evaluation_count: number;
}

// Helper to get IQ category
export function getIQCategory(iq: number): CognitiveProfile['iq_category'] {
  if (iq < 85) return 'below_average';
  if (iq < 100) return 'average';
  if (iq < 115) return 'above_average';
  if (iq < 130) return 'high';
  if (iq < 145) return 'very_high';
  return 'exceptional';
}

// IQ category display info
export const IQ_CATEGORIES: Record<CognitiveProfile['iq_category'], { label: string; color: string }> = {
  below_average: { label: 'Below Average', color: '#EF4444' },
  average: { label: 'Average', color: '#F97316' },
  above_average: { label: 'Above Average', color: '#EAB308' },
  high: { label: 'High', color: '#22C55E' },
  very_high: { label: 'Very High', color: '#3B82F6' },
  exceptional: { label: 'Exceptional', color: '#8B5CF6' },
};
