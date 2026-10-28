import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { NotFoundError, DatabaseError, ValidationError } from '../utils/apiError';
import { llmService } from '../services/llm.service';
import { ragService } from '../services/rag.service';
import { getQuizGenerationPrompt, type QuizQuestion } from '../prompts/quiz.prompts';
import { logger } from '../utils/logger';
import { gamificationService, XP_AWARDS } from '../services/gamification.service';
import { iqService } from '../services/iq.service';
import type {
  GenerateQuizInput,
  SubmitAttemptInput,
  ListQuizzesInput,
  GetQuizAttemptsInput,
} from '../schemas/quiz.schema';

/**
 * Generate a new quiz with AI
 * POST /api/quiz/generate
 */
export const generateQuiz = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as GenerateQuizInput;

  logger.info({ userId, input }, 'Generating quiz');

  try {
    // Get user profile for class level
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class, board')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found. Please complete your profile first.');
    }

    // Search RAG for context
    logger.info(
      {
        query: `${input.subject} ${input.chapter} ${input.topic || ''}`,
        filters: {
          class: profile.class,
          subject: input.subject,
          chapter: input.chapter,
        },
      },
      'Searching RAG for quiz context'
    );

    const ragContext = await ragService.searchRelevantContext(
      `${input.subject} ${input.chapter} ${input.topic || ''}`,
      {
        class: profile.class,
        subject: input.subject,
        chapter: input.chapter,
      },
      5 // Get 5 chunks for quiz generation
    );

    const contextText = ragContext.contextText || 'No specific NCERT content found. Use general knowledge.';

    // Generate quiz questions with LLM
    const systemPrompt = 'You are an expert NCERT exam question generator for Indian school students. Generate high-quality, curriculum-aligned quiz questions.';
    const userPrompt = getQuizGenerationPrompt({
      studentClass: profile.class,
      board: profile.board,
      subject: input.subject,
      chapter: input.chapter,
      difficulty: input.difficulty,
      numQuestions: input.num_questions,
      ragContext: contextText,
      questionType: input.question_type,
    });

    logger.info({ operation: 'quiz-generation', promptLength: userPrompt.length }, 'Generating quiz with AI');

    // Generate questions as JSON
    const questions = await llmService.generateJSON<QuizQuestion[]>(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.8, // Higher temperature for variety
        maxTokens: 3000,
      }
    );

    logger.info({ questionCount: questions.length }, 'Quiz questions generated');

    // Save quiz to database
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        user_id: userId,
        created_by: 'system',
        subject: input.subject,
        topic: input.topic || input.chapter,
        chapter: input.chapter,
        difficulty: input.difficulty,
        total_questions: questions.length,
        config: {
          questions, // Store questions in config JSONB
          question_type: input.question_type || 'mcq',
          rag_used: ragContext.chunks.length > 0,
        },
      })
      .select()
      .single();

    if (quizError) {
      logger.error({ error: quizError }, 'Failed to save quiz');
      throw new DatabaseError('Failed to save quiz');
    }

    logger.info({ quizId: quiz.id, questionCount: questions.length }, 'Quiz generated');

    // Return quiz without correct answers and explanations (for practice mode)
    const questionsForUser = questions.map((q) => ({
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      topic: q.topic,
    }));

    res.json(
      successResponse({
        quiz: {
          id: quiz.id,
          subject: quiz.subject,
          chapter: quiz.chapter,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          total_questions: quiz.total_questions,
          created_at: quiz.created_at,
        },
        questions: questionsForUser,
      })
    );
  } catch (error) {
    logger.error({ error, userId, input }, 'Quiz generation failed');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to generate quiz');
  }
};

/**
 * Submit quiz attempt and get results
 * POST /api/quiz/attempt
 */
export const submitAttempt = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as SubmitAttemptInput;

  logger.info({ userId, quizId: input.quiz_id }, 'Submitting quiz attempt');

  try {
    // Get quiz with questions
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', input.quiz_id)
      .single();

    if (quizError || !quiz) {
      throw new NotFoundError('Quiz not found');
    }

    // Verify quiz belongs to user
    if (quiz.user_id !== userId) {
      throw new ValidationError('Access denied');
    }

    const questions = quiz.config.questions as QuizQuestion[];

    if (!questions || questions.length === 0) {
      throw new ValidationError('Quiz has no questions');
    }

    // Evaluate answers
    let correctCount = 0;
    const results = input.answers.map((answer) => {
      const question = questions[answer.question_index];

      if (!question) {
        return {
          question_index: answer.question_index,
          is_correct: false,
          error: 'Question not found',
        };
      }

      const isCorrect = answer.selected_answer === question.correct_answer;
      if (isCorrect) correctCount++;

      return {
        question_index: answer.question_index,
        question: question.question,
        selected_answer: answer.selected_answer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        explanation: question.explanation,
      };
    });

    // Save attempt to database
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: input.quiz_id,
        user_id: userId,
        correct_answers: correctCount,
        total_questions: input.answers.length,
        time_taken_seconds: input.time_taken_seconds || 0,
        attempt_meta: {
          results,
          answered_count: input.answers.length,
        },
      })
      .select()
      .single();

    if (attemptError) {
      logger.error({ error: attemptError }, 'Failed to save quiz attempt');
      throw new DatabaseError('Failed to save quiz attempt');
    }

    logger.info(
      { attemptId: attempt.id, score: attempt.score_percent },
      'Quiz attempt submitted'
    );

    // Update user profile weak/strong topics based on performance
    // Fire and forget - don't block response
    updateTopicsFromQuiz(userId, quiz, results).catch((err) =>
      logger.error({ error: err }, 'Failed to update topics from quiz')
    );

    // Award XP based on quiz performance (fire and forget)
    awardQuizXP(userId, attempt.id, correctCount, input.answers.length).catch((err) =>
      logger.error({ error: err }, 'Failed to award quiz XP')
    );

    // Update IQ/Knowledge levels based on quiz performance (fire and forget)
    updateIQFromQuiz(userId, attempt.id, quiz, correctCount, input.answers.length, input.time_taken_seconds || 0).catch((err) =>
      logger.error({ error: err }, 'Failed to update IQ from quiz')
    );

    res.json(
      successResponse({
        attempt: {
          id: attempt.id,
          score_percent: attempt.score_percent,
          correct_answers: correctCount,
          total_questions: input.answers.length,
          time_taken_seconds: input.time_taken_seconds || 0,
        },
        results,
      })
    );
  } catch (error) {
    logger.error({ error, userId, quizId: input.quiz_id }, 'Quiz attempt failed');
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to submit quiz attempt');
  }
};

/**
 * Get a specific quiz (for review or retry)
 * GET /api/quiz/:quiz_id
 */
export const getQuiz = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { quiz_id } = req.params;

  try {
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quiz_id)
      .single();

    if (error || !quiz) {
      throw new NotFoundError('Quiz not found');
    }

    // Verify ownership
    if (quiz.user_id !== userId) {
      throw new ValidationError('Access denied');
    }

    // Fetch latest attempt for this quiz
    const { data: latestAttempt } = await supabase
      .from('quiz_attempts')
      .select('id, score_percent, correct_answers, total_questions, time_taken_seconds, attempt_meta, created_at')
      .eq('quiz_id', quiz_id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Return questions without correct answers (for retake)
    const questions = (quiz.config.questions as QuizQuestion[]).map((q) => ({
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      topic: q.topic,
    }));

    res.json(
      successResponse({
        quiz: {
          id: quiz.id,
          subject: quiz.subject,
          chapter: quiz.chapter,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          total_questions: quiz.total_questions,
          created_at: quiz.created_at,
        },
        questions,
        // Include latest attempt if exists
        latest_attempt: latestAttempt ? {
          id: latestAttempt.id,
          score_percent: latestAttempt.score_percent,
          correct_answers: latestAttempt.correct_answers,
          total_questions: latestAttempt.total_questions,
          time_taken_seconds: latestAttempt.time_taken_seconds,
          results: (latestAttempt.attempt_meta as any)?.results || [],
          completed_at: latestAttempt.created_at,
        } : null,
      })
    );
  } catch (error) {
    logger.error({ error, userId, quiz_id }, 'Failed to get quiz');
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    throw new DatabaseError('Failed to get quiz');
  }
};

/**
 * List user's quizzes with filters
 * GET /api/quiz/list
 */
export const listQuizzes = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const rawInput = req.query as unknown as ListQuizzesInput;
  
  // Apply defaults for pagination
  const input = {
    page: Number(rawInput.page) || 1,
    limit: Number(rawInput.limit) || 10,
    subject: rawInput.subject,
    difficulty: rawInput.difficulty,
  };

  try {
    let query = supabase
      .from('quizzes')
      .select('id, subject, chapter, topic, difficulty, total_questions, created_at', {
        count: 'exact',
      })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (input.subject) {
      query = query.eq('subject', input.subject);
    }
    if (input.difficulty) {
      query = query.eq('difficulty', input.difficulty);
    }

    // Pagination
    const from = (input.page - 1) * input.limit;
    const to = from + input.limit - 1;
    query = query.range(from, to);

    const { data: quizzes, error, count } = await query;

    if (error) {
      logger.error({ error }, 'Failed to list quizzes');
      throw new DatabaseError('Failed to list quizzes');
    }

    // Fetch latest attempts for all quizzes
    let quizzesWithAttempts = quizzes || [];
    
    if (quizzes && quizzes.length > 0) {
      const quizIds = quizzes.map(q => q.id);
      
      // Get all attempts for these quizzes, ordered by created_at desc
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quiz_id, score_percent, correct_answers, total_questions, created_at')
        .in('quiz_id', quizIds)
        .order('created_at', { ascending: false });

      // Group by quiz_id and take the first (latest) attempt for each
      const latestAttempts = new Map<string, {
        quiz_id: string;
        score_percent: number;
        correct_answers: number;
        total_questions: number;
        created_at: string;
      }>();
      
      attempts?.forEach(attempt => {
        if (!latestAttempts.has(attempt.quiz_id)) {
          latestAttempts.set(attempt.quiz_id, attempt);
        }
      });

      // Merge attempts with quizzes
      quizzesWithAttempts = quizzes.map(quiz => ({
        ...quiz,
        latest_attempt: latestAttempts.has(quiz.id) ? {
          score: latestAttempts.get(quiz.id)!.correct_answers,
          total_questions: latestAttempts.get(quiz.id)!.total_questions,
          percentage: latestAttempts.get(quiz.id)!.score_percent,
          completed_at: latestAttempts.get(quiz.id)!.created_at,
        } : null,
      }));
    }

    res.json(
      successResponse({
        quizzes: quizzesWithAttempts,
        pagination: {
          page: input.page,
          limit: input.limit,
          total: count || 0,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to list quizzes');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to list quizzes');
  }
};

/**
 * Get quiz attempts (history)
 * GET /api/quiz/attempts/:quiz_id
 */
export const getQuizAttempts = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { quiz_id } = req.params;
  const input = req.query as unknown as GetQuizAttemptsInput;

  try {
    // Verify quiz ownership
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id')
      .eq('id', quiz_id)
      .eq('user_id', userId)
      .single();

    if (quizError || !quiz) {
      throw new NotFoundError('Quiz not found');
    }

    // Get attempts
    const from = (input.page - 1) * input.limit;
    const to = from + input.limit - 1;

    const { data: attempts, error, count } = await supabase
      .from('quiz_attempts')
      .select('id, correct_answers, total_questions, score_percent, time_taken_seconds, created_at', {
        count: 'exact',
      })
      .eq('quiz_id', quiz_id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error({ error }, 'Failed to get quiz attempts');
      throw new DatabaseError('Failed to get quiz attempts');
    }

    res.json(
      successResponse({
        attempts: attempts || [],
        pagination: {
          page: input.page,
          limit: input.limit,
          total: count || 0,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId, quiz_id }, 'Failed to get quiz attempts');
    if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get quiz attempts');
  }
};

/**
 * Delete quiz
 * DELETE /api/quiz/:quiz_id
 */
export const deleteQuiz = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { quiz_id } = req.params;

  try {
    // Verify ownership and delete
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', quiz_id)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error }, 'Failed to delete quiz');
      throw new DatabaseError('Failed to delete quiz');
    }

    logger.info({ userId, quiz_id }, 'Quiz deleted');

    res.json(successResponse({ message: 'Quiz deleted successfully' }));
  } catch (error) {
    logger.error({ error, userId, quiz_id }, 'Failed to delete quiz');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete quiz');
  }
};

/**
 * Helper: Award XP based on quiz performance
 */
async function awardQuizXP(
  userId: string,
  attemptId: string,
  correctCount: number,
  totalQuestions: number
): Promise<void> {
  try {
    const accuracy = correctCount / totalQuestions;

    // Determine XP based on performance tier
    let xpAmount: number;
    let reason: string;

    if (accuracy >= 1.0) {
      // Perfect score
      xpAmount = XP_AWARDS.QUIZ_ACE;
      reason = 'Perfect quiz score (100%)';
    } else if (accuracy >= 0.8) {
      // Good performance
      xpAmount = XP_AWARDS.QUIZ_GOOD;
      reason = 'Good quiz score (80%+)';
    } else if (accuracy >= 0.6) {
      // Passing score
      xpAmount = XP_AWARDS.QUIZ_PASS;
      reason = 'Passed quiz (60%+)';
    } else {
      // Below passing - still get some XP for effort
      xpAmount = Math.round(XP_AWARDS.QUIZ_PASS / 2);
      reason = 'Completed quiz';
    }

    await gamificationService.awardXP(userId, xpAmount, 'quiz', attemptId, reason);

    // Check for new badges
    await gamificationService.checkAndAwardBadges(userId);

    logger.info({ userId, attemptId, xpAmount, accuracy }, 'Quiz XP awarded');
  } catch (error) {
    logger.error({ error }, 'Failed to award quiz XP');
    // Don't throw - this is best effort
  }
}

/**
 * Helper: Update weak/strong topics based on quiz performance
 */
async function updateTopicsFromQuiz(
  userId: string,
  quiz: any,
  results: any[]
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('user_profile')
      .select('weak_topics, strong_topics')
      .eq('user_id', userId)
      .single();

    if (!profile) return;

    const weakTopics = new Set<string>(profile.weak_topics || []);
    const strongTopics = new Set<string>(profile.strong_topics || []);

    // Analyze results
    const correctQuestions = results.filter((r) => r.is_correct);
    const incorrectQuestions = results.filter((r) => !r.is_correct);

    // Add to weak topics if < 60% correct
    const accuracy = correctQuestions.length / results.length;
    if (accuracy < 0.6 && quiz.topic) {
      weakTopics.add(quiz.topic);
      strongTopics.delete(quiz.topic); // Remove from strong if it was there
    }

    // Add to strong topics if >= 80% correct
    if (accuracy >= 0.8 && quiz.topic) {
      strongTopics.add(quiz.topic);
      weakTopics.delete(quiz.topic); // Remove from weak if it was there
    }

    // Update profile
    await supabase
      .from('user_profile')
      .update({
        weak_topics: Array.from(weakTopics),
        strong_topics: Array.from(strongTopics),
      })
      .eq('user_id', userId);

    logger.info({ userId, accuracy, topic: quiz.topic }, 'Updated topics from quiz');
  } catch (error) {
    logger.error({ error }, 'Failed to update topics from quiz');
    // Don't throw - this is best effort
  }
}

/**
 * Helper: Update IQ and Knowledge levels from quiz performance
 */
async function updateIQFromQuiz(
  userId: string,
  attemptId: string,
  quiz: any,
  correctCount: number,
  totalQuestions: number,
  timeTakenSeconds: number
): Promise<void> {
  try {
    const accuracy = correctCount / totalQuestions;
    const expectedTimeSeconds = totalQuestions * 60; // Assume 1 min per question

    await iqService.updateFromQuiz(userId, attemptId, {
      accuracy,
      difficulty: quiz.difficulty || 'medium',
      time_taken_seconds: timeTakenSeconds,
      expected_time_seconds: expectedTimeSeconds,
      subject: quiz.subject,
      questions: [], // Could be populated with per-question data if available
    });

    logger.info({ userId, attemptId, accuracy, subject: quiz.subject }, 'Updated IQ from quiz');
  } catch (error) {
    logger.error({ error }, 'Failed to update IQ from quiz');
    // Don't throw - this is best effort
  }
}
