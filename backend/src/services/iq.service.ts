import { supabase } from '../db/supabase';
import { logger } from '../utils/logger';

/**
 * Bloom's Taxonomy Levels
 * Used to categorize cognitive complexity of questions/tasks
 */
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

/**
 * Bloom level weights for IQ calculation
 * Higher levels indicate more complex thinking
 */
export const BLOOM_WEIGHTS: Record<BloomLevel, number> = {
  remember: 1.0,
  understand: 1.5,
  apply: 2.0,
  analyze: 2.5,
  evaluate: 3.0,
  create: 3.5,
};

/**
 * IQ Level structure
 */
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

/**
 * Knowledge Level structure
 */
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

/**
 * Tutor Evaluation Input
 * Sent by the AI tutor tool when evaluating a user's question
 */
export interface TutorEvaluation {
  bloom_level: BloomLevel;
  question_complexity: number; // 1-10
  demonstrates_understanding: boolean;
  reasoning_quality: number; // 1-10
  subject?: string;
  topic?: string;
  chapter?: string;
}

/**
 * Quiz Results for IQ Update
 */
export interface QuizResults {
  accuracy: number; // 0-1
  difficulty: 'easy' | 'medium' | 'hard';
  time_taken_seconds: number;
  expected_time_seconds: number;
  subject: string;
  questions: Array<{
    correct: boolean;
    difficulty?: string;
    topic?: string;
  }>;
}

/**
 * Evaluation Record
 */
export interface IQEvaluation {
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

/**
 * IQ Service
 * Manages user IQ and knowledge level tracking
 */
class IQService {
  /**
   * Get user's IQ level
   */
  async getIQLevel(userId: string): Promise<IQLevel | null> {
    try {
      const { data, error } = await supabase
        .from('user_iq_level')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found - return null
          return null;
        }
        throw error;
      }

      return {
        iq_score: parseFloat(data.iq_score),
        logical_reasoning: parseFloat(data.logical_reasoning),
        problem_solving: parseFloat(data.problem_solving),
        conceptual_understanding: parseFloat(data.conceptual_understanding),
        analytical_thinking: parseFloat(data.analytical_thinking),
        memory_retention: parseFloat(data.memory_retention),
        confidence: parseFloat(data.confidence),
        evaluation_count: data.evaluation_count,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get IQ level');
      return null;
    }
  }

  /**
   * Get user's knowledge levels (all subjects or specific)
   */
  async getKnowledgeLevels(userId: string, subject?: string): Promise<KnowledgeLevel[]> {
    try {
      let query = supabase
        .from('user_knowledge_level')
        .select('*')
        .eq('user_id', userId);

      if (subject) {
        query = query.eq('subject', subject);
      }

      const { data, error } = await query.order('subject');

      if (error) {
        throw error;
      }

      return (data || []).map((row) => ({
        class: row.class,
        subject: row.subject,
        knowledge_score: parseFloat(row.knowledge_score),
        remember_level: parseFloat(row.remember_level),
        understand_level: parseFloat(row.understand_level),
        apply_level: parseFloat(row.apply_level),
        analyze_level: parseFloat(row.analyze_level),
        evaluate_level: parseFloat(row.evaluate_level),
        create_level: parseFloat(row.create_level),
        quiz_data_points: row.quiz_data_points,
        tutor_data_points: row.tutor_data_points,
      }));
    } catch (error) {
      logger.error({ error, userId, subject }, 'Failed to get knowledge levels');
      return [];
    }
  }

  /**
   * Update IQ from quiz results
   */
  async updateFromQuiz(
    userId: string,
    attemptId: string,
    results: QuizResults
  ): Promise<{ iq_delta: number; knowledge_delta: number } | null> {
    try {
      // Calculate IQ evaluation score based on quiz performance
      const evaluationScore = this.calculateQuizIQScore(results);

      // Get user class
      const { data: profile } = await supabase
        .from('user_profile')
        .select('class')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        logger.warn({ userId }, 'No profile found for IQ update');
        return null;
      }

      // Update IQ score
      const { data: iqResult, error: iqError } = await supabase.rpc('update_user_iq', {
        p_user_id: userId,
        p_evaluation_score: evaluationScore,
        p_source: 'quiz',
        p_source_id: attemptId,
        p_subject: results.subject,
        p_reasoning: `Quiz accuracy: ${(results.accuracy * 100).toFixed(1)}%, difficulty: ${results.difficulty}`,
      });

      if (iqError) {
        logger.error({ error: iqError }, 'Failed to update IQ from quiz');
      }

      // Determine dominant bloom level from quiz
      const bloomLevel = this.getQuizBloomLevel(results);
      const bloomScore = results.accuracy * 100;

      // Update knowledge level
      const { data: knowledgeResult, error: knowledgeError } = await supabase.rpc(
        'update_user_knowledge',
        {
          p_user_id: userId,
          p_class: profile.class,
          p_subject: results.subject,
          p_bloom_level: bloomLevel,
          p_score: bloomScore,
          p_source: 'quiz',
          p_source_id: attemptId,
        }
      );

      if (knowledgeError) {
        logger.error({ error: knowledgeError }, 'Failed to update knowledge from quiz');
      }

      logger.info(
        {
          userId,
          attemptId,
          iqDelta: iqResult?.[0]?.iq_delta,
          knowledgeDelta: knowledgeResult?.[0]?.knowledge_delta,
        },
        'Updated IQ/knowledge from quiz'
      );

      return {
        iq_delta: iqResult?.[0]?.iq_delta || 0,
        knowledge_delta: knowledgeResult?.[0]?.knowledge_delta || 0,
      };
    } catch (error) {
      logger.error({ error, userId, attemptId }, 'Failed to update from quiz');
      return null;
    }
  }

  /**
   * Update IQ/Knowledge from tutor interaction
   * Called by the AI tutor tool
   */
  async updateFromTutor(
    userId: string,
    sessionId: string,
    evaluation: TutorEvaluation
  ): Promise<{ iq_delta: number; knowledge_delta: number } | null> {
    try {
      // Calculate IQ evaluation score from tutor evaluation
      const evaluationScore = this.calculateTutorIQScore(evaluation);

      // Get user class
      const { data: profile } = await supabase
        .from('user_profile')
        .select('class')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        logger.warn({ userId }, 'No profile found for tutor IQ update');
        return null;
      }

      // Update IQ score
      const { data: iqResult, error: iqError } = await supabase.rpc('update_user_iq', {
        p_user_id: userId,
        p_evaluation_score: evaluationScore,
        p_source: 'tutor',
        p_source_id: sessionId,
        p_subject: evaluation.subject || null,
        p_bloom_level: evaluation.bloom_level,
        p_question_complexity: evaluation.question_complexity,
        p_demonstrates_understanding: evaluation.demonstrates_understanding,
        p_reasoning_quality: evaluation.reasoning_quality,
        p_reasoning: `Bloom: ${evaluation.bloom_level}, Complexity: ${evaluation.question_complexity}/10, Understanding: ${evaluation.demonstrates_understanding}`,
      });

      if (iqError) {
        logger.error({ error: iqError }, 'Failed to update IQ from tutor');
      }

      // Update knowledge level if subject is provided
      let knowledgeDelta = 0;
      if (evaluation.subject) {
        // Calculate knowledge score based on question quality
        const knowledgeScore =
          evaluation.question_complexity * 10 * (evaluation.demonstrates_understanding ? 1.2 : 0.8);

        const { data: knowledgeResult, error: knowledgeError } = await supabase.rpc(
          'update_user_knowledge',
          {
            p_user_id: userId,
            p_class: profile.class,
            p_subject: evaluation.subject,
            p_bloom_level: evaluation.bloom_level,
            p_score: Math.min(100, knowledgeScore),
            p_source: 'tutor',
            p_source_id: sessionId,
          }
        );

        if (knowledgeError) {
          logger.error({ error: knowledgeError }, 'Failed to update knowledge from tutor');
        }

        knowledgeDelta = knowledgeResult?.[0]?.knowledge_delta || 0;
      }

      logger.info(
        {
          userId,
          sessionId,
          bloomLevel: evaluation.bloom_level,
          complexity: evaluation.question_complexity,
          iqDelta: iqResult?.[0]?.iq_delta,
          knowledgeDelta,
        },
        'Updated IQ/knowledge from tutor'
      );

      return {
        iq_delta: iqResult?.[0]?.iq_delta || 0,
        knowledge_delta: knowledgeDelta,
      };
    } catch (error) {
      logger.error({ error, userId, sessionId, evaluation }, 'Failed to update from tutor');
      return null;
    }
  }

  /**
   * Get evaluation history
   */
  async getEvaluationHistory(
    userId: string,
    limit: number = 50
  ): Promise<IQEvaluation[]> {
    try {
      const { data, error } = await supabase
        .from('iq_evaluations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => ({
        id: row.id,
        source: row.source,
        source_id: row.source_id,
        subject: row.subject,
        evaluation_type: row.evaluation_type,
        previous_iq: row.previous_iq ? parseFloat(row.previous_iq) : undefined,
        new_iq: row.new_iq ? parseFloat(row.new_iq) : undefined,
        iq_delta: row.iq_delta ? parseFloat(row.iq_delta) : undefined,
        previous_knowledge: row.previous_knowledge ? parseFloat(row.previous_knowledge) : undefined,
        new_knowledge: row.new_knowledge ? parseFloat(row.new_knowledge) : undefined,
        knowledge_delta: row.knowledge_delta ? parseFloat(row.knowledge_delta) : undefined,
        bloom_level: row.bloom_level,
        question_complexity: row.question_complexity,
        reasoning: row.reasoning,
        created_at: row.created_at,
      }));
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get evaluation history');
      return [];
    }
  }

  /**
   * Force recalculation of IQ from all historical data
   */
  async recalculate(userId: string): Promise<{ iq: number; knowledge: KnowledgeLevel[] } | null> {
    try {
      // Get all evaluations for the user
      const { data: evaluations, error } = await supabase
        .from('iq_evaluations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (!evaluations || evaluations.length === 0) {
        return null;
      }

      // Reset IQ to baseline
      await supabase
        .from('user_iq_level')
        .upsert({
          user_id: userId,
          iq_score: 100.0,
          confidence: 0.0,
          evaluation_count: 0,
        });

      // Replay all evaluations
      for (const eval_ of evaluations) {
        if (eval_.new_iq) {
          // This is a simplified recalculation - in production you'd recalculate from raw scores
          await supabase.rpc('update_user_iq', {
            p_user_id: userId,
            p_evaluation_score: eval_.new_iq,
            p_source: 'manual',
            p_source_id: 'recalculation',
          });
        }
      }

      // Get final values
      const iqLevel = await this.getIQLevel(userId);
      const knowledgeLevels = await this.getKnowledgeLevels(userId);

      logger.info({ userId, newIQ: iqLevel?.iq_score }, 'Recalculated IQ');

      return {
        iq: iqLevel?.iq_score || 100,
        knowledge: knowledgeLevels,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to recalculate IQ');
      return null;
    }
  }

  /**
   * Initialize IQ tracking for a new user
   */
  async initializeUser(userId: string): Promise<void> {
    try {
      // Check if already exists
      const existing = await this.getIQLevel(userId);
      if (existing) return;

      // Create initial IQ record
      await supabase.from('user_iq_level').insert({
        user_id: userId,
        iq_score: 100.0,
        logical_reasoning: 50.0,
        problem_solving: 50.0,
        conceptual_understanding: 50.0,
        analytical_thinking: 50.0,
        memory_retention: 50.0,
        confidence: 0.0,
        evaluation_count: 0,
      });

      logger.info({ userId }, 'Initialized IQ tracking for user');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to initialize user IQ');
    }
  }

  // =========================
  // Private Helper Methods
  // =========================

  /**
   * Calculate IQ evaluation score from quiz results
   * Returns a score on the 50-150 IQ scale
   */
  private calculateQuizIQScore(results: QuizResults): number {
    // Base score from accuracy (50-100 accuracy maps to 80-120 IQ contribution)
    let score = 80 + results.accuracy * 40;

    // Difficulty modifier
    const difficultyMultiplier = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.2,
    };
    score *= difficultyMultiplier[results.difficulty];

    // Time bonus/penalty
    const timeRatio = results.time_taken_seconds / results.expected_time_seconds;
    if (timeRatio < 0.5) {
      // Very fast - bonus
      score += 5;
    } else if (timeRatio > 1.5) {
      // Slow - small penalty
      score -= 3;
    }

    // Normalize to IQ scale (50-150)
    score = Math.max(50, Math.min(150, score));

    return score;
  }

  /**
   * Calculate IQ evaluation score from tutor evaluation
   * Returns a score on the 50-150 IQ scale
   */
  private calculateTutorIQScore(evaluation: TutorEvaluation): number {
    // Base score starts at 100 (average)
    let score = 100;

    // Bloom level contribution (+/- 0-15 points)
    const bloomContribution = (BLOOM_WEIGHTS[evaluation.bloom_level] - 2) * 5;
    score += bloomContribution;

    // Question complexity contribution (+/- 0-10 points)
    // Complexity 5 is neutral, <5 subtracts, >5 adds
    score += (evaluation.question_complexity - 5) * 2;

    // Understanding demonstration (+/- 5 points)
    if (evaluation.demonstrates_understanding) {
      score += 5;
    } else {
      score -= 3;
    }

    // Reasoning quality contribution (+/- 0-10 points)
    score += (evaluation.reasoning_quality - 5) * 2;

    // Normalize to IQ scale (50-150)
    score = Math.max(50, Math.min(150, score));

    return score;
  }

  /**
   * Determine the dominant Bloom level from quiz results
   */
  private getQuizBloomLevel(results: QuizResults): BloomLevel {
    // Map difficulty to bloom level
    // Easy quizzes test remember/understand
    // Medium quizzes test apply/analyze
    // Hard quizzes test evaluate/create
    const difficultyMap: Record<string, BloomLevel> = {
      easy: results.accuracy >= 0.8 ? 'understand' : 'remember',
      medium: results.accuracy >= 0.8 ? 'analyze' : 'apply',
      hard: results.accuracy >= 0.8 ? 'create' : 'evaluate',
    };

    return difficultyMap[results.difficulty] || 'understand';
  }
}

/**
 * Singleton instance
 */
export const iqService = new IQService();
