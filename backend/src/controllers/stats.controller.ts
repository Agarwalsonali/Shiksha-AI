import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse } from '../utils/apiResponse';
import { DatabaseError } from '../utils/apiError';
import { logger } from '../utils/logger';
import type {
  GetOverviewInput,
  GetTopicStatsInput,
  GetQuizPerformanceInput,
  GetStudyActivityInput,
  GetRecommendationsInput,
} from '../schemas/stats.schema';

/**
 * Get overview statistics
 * GET /api/stats/overview
 */
export const getOverview = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetOverviewInput;

  logger.info({ userId, days: input.days }, 'Fetching overview stats');

  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - input.days);

    // Get quiz stats
    const { data: quizAttempts } = await supabase
      .from('quiz_attempts')
      .select('score_percent, created_at')
      .eq('user_id', userId)
      .gte('created_at', daysAgo.toISOString());

    const totalQuizzes = quizAttempts?.length || 0;
    const avgQuizScore = totalQuizzes > 0
      ? Math.round(quizAttempts!.reduce((sum, a) => sum + a.score_percent, 0) / totalQuizzes)
      : 0;

    // Get tutor sessions count
    const { count: tutorSessions } = await supabase
      .from('tutor_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', daysAgo.toISOString());

    // Get study plans count
    const { count: studyPlans } = await supabase
      .from('study_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', daysAgo.toISOString());

    // Get completed tasks
    const { count: completedTasks } = await supabase
      .from('plan_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', daysAgo.toISOString());

    // Get total study time (from completed tasks)
    const { data: tasks } = await supabase
      .from('plan_tasks')
      .select('duration_min')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', daysAgo.toISOString());

    const totalStudyMinutes = tasks?.reduce((sum, t) => sum + (t.duration_min || 0), 0) || 0;

    // Get profile for weak/strong topics
    const { data: profile } = await supabase
      .from('user_profile')
      .select('weak_topics, strong_topics')
      .eq('user_id', userId)
      .single();

    res.json(
      successResponse({
        overview: {
          period_days: input.days,
          total_quizzes: totalQuizzes,
          avg_quiz_score: avgQuizScore,
          tutor_sessions: tutorSessions || 0,
          study_plans_created: studyPlans || 0,
          tasks_completed: completedTasks || 0,
          total_study_hours: Math.round(totalStudyMinutes / 60 * 10) / 10, // Round to 1 decimal
          weak_topics_count: profile?.weak_topics?.length || 0,
          strong_topics_count: profile?.strong_topics?.length || 0,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get overview stats');
    throw new DatabaseError('Failed to get overview stats');
  }
};

/**
 * Get topic-wise statistics
 * GET /api/stats/topics
 */
export const getTopicStats = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetTopicStatsInput;

  logger.info({ userId, subject: input.subject }, 'Fetching topic stats');

  try {
    // Get profile topics
    const { data: profile } = await supabase
      .from('user_profile')
      .select('weak_topics, strong_topics')
      .eq('user_id', userId)
      .single();

    // Get quiz attempts grouped by topic
    let query = supabase
      .from('quizzes')
      .select('topic, difficulty, config, quiz_attempts(score_percent)')
      .eq('user_id', userId);

    if (input.subject) {
      query = query.eq('subject', input.subject);
    }

    const { data: quizData } = await query;

    // Aggregate by topic
    const topicMap = new Map<string, { attempts: number; avgScore: number; difficulty: string }>();

    quizData?.forEach((quiz) => {
      const topic = quiz.topic;
      if (!topic) return;

      const attempts = (quiz.quiz_attempts as any[]) || [];
      if (attempts.length === 0) return;

      const avgScore = attempts.reduce((sum, a) => sum + a.score_percent, 0) / attempts.length;

      if (topicMap.has(topic)) {
        const existing = topicMap.get(topic)!;
        topicMap.set(topic, {
          attempts: existing.attempts + attempts.length,
          avgScore: (existing.avgScore * existing.attempts + avgScore * attempts.length) / (existing.attempts + attempts.length),
          difficulty: quiz.difficulty,
        });
      } else {
        topicMap.set(topic, {
          attempts: attempts.length,
          avgScore,
          difficulty: quiz.difficulty,
        });
      }
    });

    // Convert to array and sort by average score (weakest first)
    const topics = Array.from(topicMap.entries())
      .map(([topic, stats]) => ({
        topic,
        attempts: stats.attempts,
        avg_score: Math.round(stats.avgScore),
        is_weak: profile?.weak_topics?.includes(topic) || false,
        is_strong: profile?.strong_topics?.includes(topic) || false,
      }))
      .sort((a, b) => a.avg_score - b.avg_score)
      .slice(0, input.limit);

    res.json(
      successResponse({
        topics,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get topic stats');
    throw new DatabaseError('Failed to get topic stats');
  }
};

/**
 * Get quiz performance over time
 * GET /api/stats/quiz-performance
 */
export const getQuizPerformance = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetQuizPerformanceInput;

  logger.info({ userId, days: input.days }, 'Fetching quiz performance');

  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - input.days);

    // Get quiz attempts with quiz metadata
    let query = supabase
      .from('quiz_attempts')
      .select('score_percent, created_at, quizzes(subject, difficulty, topic)')
      .eq('user_id', userId)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: true });

    const { data: attempts } = await query;

    if (!attempts || attempts.length === 0) {
      return res.json(
        successResponse({
          performance: {
            total_attempts: 0,
            avg_score: 0,
            trend: 'neutral',
            by_difficulty: {},
            recent_attempts: [],
          },
        })
      );
    }

    // Calculate overall stats
    const totalAttempts = attempts.length;
    const avgScore = Math.round(
      attempts.reduce((sum, a) => sum + a.score_percent, 0) / totalAttempts
    );

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(totalAttempts / 2);
    const firstHalfAvg = attempts.slice(0, midpoint).reduce((sum, a) => sum + a.score_percent, 0) / midpoint || 0;
    const secondHalfAvg = attempts.slice(midpoint).reduce((sum, a) => sum + a.score_percent, 0) / (totalAttempts - midpoint);
    const trend = secondHalfAvg > firstHalfAvg + 5 ? 'improving' : secondHalfAvg < firstHalfAvg - 5 ? 'declining' : 'stable';

    // Group by difficulty
    const byDifficulty: any = {};
    attempts.forEach((attempt: any) => {
      const quiz = attempt.quizzes;
      if (!quiz) return;

      const difficulty = quiz.difficulty || 'medium';
      if (!byDifficulty[difficulty]) {
        byDifficulty[difficulty] = { count: 0, avg_score: 0, total_score: 0 };
      }
      byDifficulty[difficulty].count++;
      byDifficulty[difficulty].total_score += attempt.score_percent;
    });

    // Calculate averages
    Object.keys(byDifficulty).forEach((difficulty) => {
      byDifficulty[difficulty].avg_score = Math.round(
        byDifficulty[difficulty].total_score / byDifficulty[difficulty].count
      );
      delete byDifficulty[difficulty].total_score;
    });

    // Get recent attempts (last 10)
    const recentAttempts = attempts.slice(-10).map((a: any) => ({
      score_percent: a.score_percent,
      subject: a.quizzes?.subject,
      topic: a.quizzes?.topic,
      difficulty: a.quizzes?.difficulty,
      created_at: a.created_at,
    }));

    res.json(
      successResponse({
        performance: {
          total_attempts: totalAttempts,
          avg_score: avgScore,
          trend,
          by_difficulty: byDifficulty,
          recent_attempts: recentAttempts,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get quiz performance');
    throw new DatabaseError('Failed to get quiz performance');
  }
};

/**
 * Get study activity timeline
 * GET /api/stats/activity
 */
export const getStudyActivity = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetStudyActivityInput;

  logger.info({ userId, days: input.days }, 'Fetching study activity');

  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - input.days);

    // Get activity by day
    const activities: any[] = [];

    // Get tutor sessions
    const { data: tutorSessions } = await supabase
      .from('tutor_sessions')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', daysAgo.toISOString());

    tutorSessions?.forEach((session) => {
      activities.push({
        type: 'tutor_session',
        date: session.started_at.split('T')[0],
        timestamp: session.started_at,
      });
    });

    // Get quiz attempts
    const { data: quizAttempts } = await supabase
      .from('quiz_attempts')
      .select('created_at, score_percent')
      .eq('user_id', userId)
      .gte('created_at', daysAgo.toISOString());

    quizAttempts?.forEach((attempt) => {
      activities.push({
        type: 'quiz_attempt',
        date: attempt.created_at.split('T')[0],
        timestamp: attempt.created_at,
        score: attempt.score_percent,
      });
    });

    // Get completed tasks
    const { data: tasks } = await supabase
      .from('plan_tasks')
      .select('completed_at, duration_min')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', daysAgo.toISOString());

    tasks?.forEach((task) => {
      if (task.completed_at) {
        activities.push({
          type: 'task_completed',
          date: task.completed_at.split('T')[0],
          timestamp: task.completed_at,
          duration_min: task.duration_min,
        });
      }
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Group by date
    const byDate: any = {};
    activities.forEach((activity) => {
      const date = activity.date;
      if (!byDate[date]) {
        byDate[date] = {
          date,
          tutor_sessions: 0,
          quiz_attempts: 0,
          tasks_completed: 0,
          total_study_min: 0,
        };
      }

      if (activity.type === 'tutor_session') byDate[date].tutor_sessions++;
      if (activity.type === 'quiz_attempt') byDate[date].quiz_attempts++;
      if (activity.type === 'task_completed') {
        byDate[date].tasks_completed++;
        byDate[date].total_study_min += activity.duration_min || 0;
      }
    });

    res.json(
      successResponse({
        activity: {
          timeline: Object.values(byDate),
          recent_activities: activities.slice(0, 20),
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get study activity');
    throw new DatabaseError('Failed to get study activity');
  }
};

/**
 * Get study streaks
 * GET /api/stats/streaks
 */
export const getStreaks = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  logger.info({ userId }, 'Fetching study streaks');

  try {
    // Get all activity dates (tasks completed)
    const { data: tasks } = await supabase
      .from('plan_tasks')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (!tasks || tasks.length === 0) {
      return res.json(
        successResponse({
          streaks: {
            current_streak: 0,
            longest_streak: 0,
            total_active_days: 0,
          },
        })
      );
    }

    // Get unique dates
    const uniqueDates = [...new Set(tasks.map((t) => t.completed_at!.split('T')[0]))];
    uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currDate = new Date(uniqueDates[i]);
        const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    res.json(
      successResponse({
        streaks: {
          current_streak: currentStreak,
          longest_streak: longestStreak,
          total_active_days: uniqueDates.length,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get streaks');
    throw new DatabaseError('Failed to get streaks');
  }
};

/**
 * Get personalized recommendations
 * GET /api/stats/recommendations
 */
export const getRecommendations = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetRecommendationsInput;

  logger.info({ userId }, 'Generating recommendations');

  try {
    const recommendations: any[] = [];

    // Get profile
    const { data: profile } = await supabase
      .from('user_profile')
      .select('weak_topics, strong_topics')
      .eq('user_id', userId)
      .single();

    // Recommendation 1: Practice weak topics
    if (profile?.weak_topics && profile.weak_topics.length > 0) {
      recommendations.push({
        type: 'practice_weak_topics',
        priority: 'high',
        title: 'Practice Your Weak Topics',
        description: `You have ${profile.weak_topics.length} weak topic(s). Generate quizzes to improve.`,
        action: 'Generate Quiz',
        topics: profile.weak_topics.slice(0, 3),
      });
    }

    // Get recent quiz performance
    const { data: recentQuizzes } = await supabase
      .from('quiz_attempts')
      .select('score_percent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Recommendation 2: Take more quizzes if inactive
    const lastQuizDate = recentQuizzes?.[0]?.created_at;
    if (!lastQuizDate || new Date(lastQuizDate) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      recommendations.push({
        type: 'take_quiz',
        priority: 'medium',
        title: 'Take a Quiz',
        description: "You haven't taken a quiz recently. Test your knowledge!",
        action: 'Start Quiz',
      });
    }

    // Recommendation 3: Improve low scores
    const lowScoreQuizzes = recentQuizzes?.filter((q) => q.score_percent < 60) || [];
    if (lowScoreQuizzes.length >= 2) {
      recommendations.push({
        type: 'improve_scores',
        priority: 'high',
        title: 'Improve Your Scores',
        description: `You scored below 60% in ${lowScoreQuizzes.length} recent quiz(zes). Review concepts and retry.`,
        action: 'Review & Retry',
      });
    }

    // Recommendation 4: Create study plan if none exists
    const { count: planCount } = await supabase
      .from('study_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!planCount || planCount === 0) {
      recommendations.push({
        type: 'create_study_plan',
        priority: 'medium',
        title: 'Create a Study Plan',
        description: 'Stay organized with an AI-generated study plan tailored to your exam.',
        action: 'Create Plan',
      });
    }

    // Recommendation 5: Ask tutor for help
    const { count: tutorCount } = await supabase
      .from('tutor_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!tutorCount || tutorCount === 0) {
      recommendations.push({
        type: 'ask_tutor',
        priority: 'low',
        title: 'Ask the AI Tutor',
        description: 'Have doubts? Chat with the AI tutor for personalized explanations.',
        action: 'Start Chat',
      });
    }

    // Limit recommendations
    const limitedRecommendations = recommendations.slice(0, input.limit);

    res.json(
      successResponse({
        recommendations: limitedRecommendations,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get recommendations');
    throw new DatabaseError('Failed to get recommendations');
  }
};
