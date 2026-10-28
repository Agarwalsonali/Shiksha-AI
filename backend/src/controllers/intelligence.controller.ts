import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/apiResponse';
import { DatabaseError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { iqService } from '../services/iq.service';
import type {
  GetKnowledgeLevelsInput,
  GetEvaluationHistoryInput,
} from '../schemas/intelligence.schema';

/**
 * Get user's IQ level
 * GET /api/intelligence/iq
 * 
 * Note: This endpoint is for internal/admin use only.
 * The IQ score should not be directly exposed to end users.
 */
export const getIQLevel = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const iqLevel = await iqService.getIQLevel(userId);

    if (!iqLevel) {
      // Initialize IQ tracking for this user
      await iqService.initializeUser(userId);
      const newIqLevel = await iqService.getIQLevel(userId);

      return res.json(
        successResponse({
          iq_level: newIqLevel,
          is_new: true,
          message: 'IQ tracking initialized. Take quizzes and ask questions to build your profile.',
        })
      );
    }

    res.json(
      successResponse({
        iq_level: iqLevel,
        is_new: false,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get IQ level');
    throw new DatabaseError('Failed to get IQ level');
  }
};

/**
 * Get user's knowledge levels (all subjects or specific)
 * GET /api/intelligence/knowledge
 */
export const getKnowledgeLevels = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { subject } = req.query as unknown as GetKnowledgeLevelsInput;

  try {
    const knowledgeLevels = await iqService.getKnowledgeLevels(userId, subject);

    // Calculate overall stats
    const totalDataPoints = knowledgeLevels.reduce(
      (sum, k) => sum + k.quiz_data_points + k.tutor_data_points,
      0
    );
    const averageKnowledge =
      knowledgeLevels.length > 0
        ? knowledgeLevels.reduce((sum, k) => sum + k.knowledge_score, 0) / knowledgeLevels.length
        : 0;

    res.json(
      successResponse({
        knowledge_levels: knowledgeLevels,
        summary: {
          total_subjects: knowledgeLevels.length,
          average_knowledge_score: Math.round(averageKnowledge * 100) / 100,
          total_data_points: totalDataPoints,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId, subject }, 'Failed to get knowledge levels');
    throw new DatabaseError('Failed to get knowledge levels');
  }
};

/**
 * Get evaluation history
 * GET /api/intelligence/history
 */
export const getEvaluationHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { limit } = req.query as unknown as GetEvaluationHistoryInput;

  try {
    const history = await iqService.getEvaluationHistory(userId, limit || 50);

    // Group by source
    const quizEvaluations = history.filter((e) => e.source === 'quiz');
    const tutorEvaluations = history.filter((e) => e.source === 'tutor');

    res.json(
      successResponse({
        evaluations: history,
        summary: {
          total: history.length,
          quiz_evaluations: quizEvaluations.length,
          tutor_evaluations: tutorEvaluations.length,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get evaluation history');
    throw new DatabaseError('Failed to get evaluation history');
  }
};

/**
 * Force recalculation of IQ from historical data
 * POST /api/intelligence/recalculate
 */
export const recalculateIQ = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    logger.info({ userId }, 'Recalculating IQ');

    const result = await iqService.recalculate(userId);

    if (!result) {
      return res.json(
        successResponse({
          message: 'No evaluation history found. Start taking quizzes and asking questions!',
          recalculated: false,
        })
      );
    }

    res.json(
      successResponse({
        message: 'IQ and knowledge levels recalculated',
        recalculated: true,
        iq_score: result.iq,
        knowledge_levels: result.knowledge,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to recalculate IQ');
    throw new DatabaseError('Failed to recalculate IQ');
  }
};

/**
 * Get a summary of user's cognitive profile
 * GET /api/intelligence/summary
 * 
 * This returns a user-friendly summary without exposing raw IQ scores
 */
export const getIntelligenceSummary = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const [iqLevel, knowledgeLevels] = await Promise.all([
      iqService.getIQLevel(userId),
      iqService.getKnowledgeLevels(userId),
    ]);

    // Determine cognitive tier (without exposing raw IQ)
    let cognitiveTier: string;
    let cognitiveDescription: string;

    if (!iqLevel || iqLevel.evaluation_count < 5) {
      cognitiveTier = 'Calibrating';
      cognitiveDescription = 'Complete more quizzes and ask more questions to calibrate your profile.';
    } else if (iqLevel.iq_score >= 120) {
      cognitiveTier = 'Advanced';
      cognitiveDescription = 'You demonstrate strong analytical and problem-solving abilities.';
    } else if (iqLevel.iq_score >= 110) {
      cognitiveTier = 'Proficient';
      cognitiveDescription = 'You show good understanding and can handle complex concepts well.';
    } else if (iqLevel.iq_score >= 90) {
      cognitiveTier = 'Developing';
      cognitiveDescription = 'You have solid foundations and are progressing steadily.';
    } else {
      cognitiveTier = 'Building';
      cognitiveDescription = 'Focus on fundamentals and practice regularly to strengthen your skills.';
    }

    // Find strongest and weakest subjects
    const sortedByKnowledge = [...knowledgeLevels].sort(
      (a, b) => b.knowledge_score - a.knowledge_score
    );
    const strongestSubject = sortedByKnowledge[0];
    const weakestSubject = sortedByKnowledge[sortedByKnowledge.length - 1];

    // Find strongest Bloom level across all subjects
    const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
    const avgBloomScores = bloomLevels.map((level) => ({
      level,
      average:
        knowledgeLevels.length > 0
          ? knowledgeLevels.reduce((sum, k) => sum + k[`${level}_level`], 0) / knowledgeLevels.length
          : 0,
    }));
    const strongestBloom = avgBloomScores.sort((a, b) => b.average - a.average)[0];

    res.json(
      successResponse({
        cognitive_tier: cognitiveTier,
        cognitive_description: cognitiveDescription,
        confidence: iqLevel?.confidence || 0,
        evaluation_count: iqLevel?.evaluation_count || 0,
        knowledge_summary: {
          total_subjects: knowledgeLevels.length,
          strongest_subject: strongestSubject
            ? { name: strongestSubject.subject, score: strongestSubject.knowledge_score }
            : null,
          weakest_subject: weakestSubject
            ? { name: weakestSubject.subject, score: weakestSubject.knowledge_score }
            : null,
          strongest_skill: strongestBloom
            ? { level: strongestBloom.level, score: Math.round(strongestBloom.average) }
            : null,
        },
        recommendations: generateRecommendations(iqLevel, knowledgeLevels),
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get intelligence summary');
    throw new DatabaseError('Failed to get intelligence summary');
  }
};

/**
 * Generate personalized recommendations based on cognitive profile
 */
function generateRecommendations(
  iqLevel: Awaited<ReturnType<typeof iqService.getIQLevel>>,
  knowledgeLevels: Awaited<ReturnType<typeof iqService.getKnowledgeLevels>>
): string[] {
  const recommendations: string[] = [];

  if (!iqLevel || iqLevel.evaluation_count < 5) {
    recommendations.push('Take more quizzes to help us understand your learning style.');
    recommendations.push('Ask detailed questions to the AI tutor to build your profile.');
    return recommendations;
  }

  // Based on cognitive dimensions
  if (iqLevel.problem_solving < 50) {
    recommendations.push('Practice more problem-solving questions to strengthen this skill.');
  }
  if (iqLevel.analytical_thinking < 50) {
    recommendations.push('Try comparing and contrasting concepts to develop analytical thinking.');
  }
  if (iqLevel.conceptual_understanding < 50) {
    recommendations.push('Focus on understanding "why" rather than just "what" in your studies.');
  }

  // Based on knowledge levels
  const weakSubjects = knowledgeLevels.filter((k) => k.knowledge_score < 40);
  if (weakSubjects.length > 0) {
    recommendations.push(
      `Focus more on ${weakSubjects.map((s) => s.subject).join(', ')} to improve your overall performance.`
    );
  }

  // Based on Bloom levels
  for (const k of knowledgeLevels) {
    if (k.apply_level < k.understand_level - 20) {
      recommendations.push(
        `In ${k.subject}, practice applying concepts through problems rather than just understanding theory.`
      );
      break;
    }
    if (k.analyze_level < k.apply_level - 20) {
      recommendations.push(
        `In ${k.subject}, work on comparing concepts and finding patterns to strengthen analysis skills.`
      );
      break;
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('You\'re doing great! Keep up the consistent practice.');
  }

  return recommendations.slice(0, 5); // Max 5 recommendations
}
