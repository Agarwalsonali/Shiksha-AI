import { supabase } from '../db/supabase';
import { logger } from '../utils/logger';

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  score: number;
  progress_percent: number;
  quiz_avg: number;
  streak: number;
  badges_count: number;
  total_xp: number;
}

/**
 * User rank info
 */
export interface UserRank {
  rank: number | null;
  total_users: number;
  percentile: number;
  score: number;
}

/**
 * Subject leaderboard entry
 */
export interface SubjectLeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  score: number;
  quiz_avg: number;
  quiz_count: number;
  chapters_completed: number;
  chapters_total: number;
  progress_percent: number;
}

/**
 * Period leaderboard entry (weekly/monthly)
 */
export interface PeriodLeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  score: number;
  quiz_count: number;
  quiz_avg: number;
  perfect_quizzes: number;
  chapters_completed: number;
  total_xp_earned: number;
}

/**
 * Leaderboard Service
 * Handles class-based rankings and leaderboard management
 */
class LeaderboardService {
  /**
   * Get leaderboard for a class
   */
  async getClassLeaderboard(
    classNum: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ entries: LeaderboardEntry[]; total: number; updatedAt: string | null }> {
    try {
      // First, get user profiles who are visible on leaderboard for this class
      const { data: profiles, error: profileError } = await supabase
        .from('user_profile')
        .select('user_id, display_name')
        .eq('class', classNum)
        .eq('show_on_leaderboard', true);

      if (profileError) {
        logger.error({ error: profileError, classNum }, 'Failed to fetch profiles for leaderboard');
        return { entries: [], total: 0, updatedAt: null };
      }

      if (!profiles || profiles.length === 0) {
        return { entries: [], total: 0, updatedAt: null };
      }

      // Create a map of user_id to display_name
      const profileMap = new Map(profiles.map(p => [p.user_id, p.display_name || 'Anonymous']));
      const visibleUserIds = Array.from(profileMap.keys());

      // Get stats for visible users
      const { data, error, count } = await supabase
        .from('user_class_stats')
        .select(
          `
          user_id,
          overall_progress_percent,
          average_quiz_score,
          current_streak,
          total_badges,
          total_xp,
          rank_in_class,
          rank_updated_at
        `,
          { count: 'exact' }
        )
        .eq('class', classNum)
        .in('user_id', visibleUserIds)
        .order('rank_in_class', { ascending: true, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error({ error, classNum }, 'Failed to fetch leaderboard stats');
        return { entries: [], total: 0, updatedAt: null };
      }

      const entries: LeaderboardEntry[] = (data || []).map((row: any, index: number) => ({
        rank: row.rank_in_class || offset + index + 1,
        user_id: row.user_id,
        display_name: profileMap.get(row.user_id) || 'Anonymous',
        score: this.calculateCombinedScore(row),
        progress_percent: row.overall_progress_percent || 0,
        quiz_avg: Math.round(row.average_quiz_score || 0),
        streak: row.current_streak || 0,
        badges_count: row.total_badges || 0,
        total_xp: row.total_xp || 0,
      }));

      const latestUpdate = data?.[0]?.rank_updated_at || null;

      return { entries, total: count || 0, updatedAt: latestUpdate };
    } catch (error) {
      logger.error({ error, classNum }, 'Error fetching leaderboard');
      return { entries: [], total: 0, updatedAt: null };
    }
  }

  /**
   * Get user's rank in their class
   */
  async getUserRank(userId: string, classNum: number): Promise<UserRank> {
    try {
      // Get user's stats
      const { data: userStats, error: statsError } = await supabase
        .from('user_class_stats')
        .select('rank_in_class, overall_progress_percent, average_quiz_score, current_streak, total_xp')
        .eq('user_id', userId)
        .eq('class', classNum)
        .single();

      if (statsError || !userStats) {
        return { rank: null, total_users: 0, percentile: 0, score: 0 };
      }

      // Count total users in class
      const { count: totalUsers } = await supabase
        .from('user_class_stats')
        .select('*', { count: 'exact', head: true })
        .eq('class', classNum);

      const total = totalUsers || 0;
      const rank = userStats.rank_in_class;
      const percentile = rank && total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0;
      const score = this.calculateCombinedScore(userStats);

      return { rank, total_users: total, percentile, score };
    } catch (error) {
      logger.error({ error, userId, classNum }, 'Error getting user rank');
      return { rank: null, total_users: 0, percentile: 0, score: 0 };
    }
  }

  /**
   * Calculate combined score for ranking
   * Formula:
   * - Progress: 35%
   * - Quiz average: 30%
   * - Streak (capped at 100): 20%
   * - XP (normalized, capped at 100 points): 15%
   */
  private calculateCombinedScore(stats: any): number {
    const progress = stats.overall_progress_percent || 0;
    const quizAvg = stats.average_quiz_score || 0;
    const streak = Math.min(stats.current_streak || 0, 100);
    const xpNormalized = Math.min((stats.total_xp || 0) / 100, 100);

    const score = progress * 0.35 + quizAvg * 0.30 + streak * 0.20 + xpNormalized * 0.15;
    return Math.round(score * 10) / 10;
  }

  /**
   * Update user's class stats
   */
  async updateUserStats(userId: string, classNum: number): Promise<void> {
    try {
      await supabase.rpc('update_user_class_stats', {
        p_user_id: userId,
        p_class: classNum,
      });
      logger.info({ userId, classNum }, 'User class stats updated');
    } catch (error) {
      logger.error({ error, userId, classNum }, 'Failed to update user stats');
    }
  }

  /**
   * Update rankings for a class
   */
  async updateClassRankings(classNum: number): Promise<void> {
    try {
      await supabase.rpc('update_class_rankings', { p_class: classNum });
      logger.info({ classNum }, 'Class rankings updated');
    } catch (error) {
      logger.error({ error, classNum }, 'Failed to update class rankings');
    }
  }

  /**
   * Get top performers for a class (quick view)
   */
  async getTopPerformers(classNum: number, limit: number = 3): Promise<LeaderboardEntry[]> {
    const { entries } = await this.getClassLeaderboard(classNum, limit, 0);
    return entries;
  }

  /**
   * Update leaderboard privacy setting for a user
   */
  async updatePrivacySetting(
    userId: string,
    showOnLeaderboard: boolean,
    displayName?: string
  ): Promise<void> {
    const updateData: any = { show_on_leaderboard: showOnLeaderboard };
    if (displayName !== undefined) {
      updateData.display_name = displayName;
    }

    const { error } = await supabase
      .from('user_profile')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, userId }, 'Failed to update privacy setting');
      throw error;
    }

    logger.info({ userId, showOnLeaderboard }, 'Privacy setting updated');
  }

  /**
   * Get subject-wise leaderboard
   * Ranks users based on quiz performance and chapter completion for a specific subject
   */
  async getSubjectLeaderboard(
    classNum: number,
    subject: string,
    limit: number = 20
  ): Promise<SubjectLeaderboardEntry[]> {
    try {
      // Get quiz performance by subject
      const { data: quizData, error: quizError } = await supabase
        .from('quiz_attempts')
        .select(`
          user_id,
          score_percent,
          quizzes!inner (
            subject
          )
        `)
        .eq('quizzes.subject', subject);

      if (quizError) {
        logger.error({ error: quizError }, 'Failed to fetch quiz data for subject leaderboard');
      }

      // Get chapter progress by subject
      const { data: progressData, error: progressError } = await supabase
        .from('user_chapter_progress')
        .select('user_id, progress_percent, status')
        .eq('class', classNum)
        .eq('subject', subject);

      if (progressError) {
        logger.error({ error: progressError }, 'Failed to fetch progress data for subject leaderboard');
      }

      // Get user profiles for display names and privacy
      const { data: profiles, error: profileError } = await supabase
        .from('user_profile')
        .select('user_id, display_name, show_on_leaderboard, class')
        .eq('class', classNum)
        .eq('show_on_leaderboard', true);

      if (profileError) {
        logger.error({ error: profileError }, 'Failed to fetch profiles');
      }

      // Aggregate data by user
      const userScores = new Map<string, {
        quizCount: number;
        quizTotalScore: number;
        chapterCount: number;
        completedChapters: number;
        totalProgress: number;
        displayName: string;
      }>();

      // Process quiz data
      for (const quiz of (quizData || [])) {
        const userId = quiz.user_id;
        if (!userScores.has(userId)) {
          userScores.set(userId, {
            quizCount: 0,
            quizTotalScore: 0,
            chapterCount: 0,
            completedChapters: 0,
            totalProgress: 0,
            displayName: 'Anonymous',
          });
        }
        const stats = userScores.get(userId)!;
        stats.quizCount++;
        stats.quizTotalScore += quiz.score_percent || 0;
      }

      // Process progress data
      for (const progress of (progressData || [])) {
        const userId = progress.user_id;
        if (!userScores.has(userId)) {
          userScores.set(userId, {
            quizCount: 0,
            quizTotalScore: 0,
            chapterCount: 0,
            completedChapters: 0,
            totalProgress: 0,
            displayName: 'Anonymous',
          });
        }
        const stats = userScores.get(userId)!;
        stats.chapterCount++;
        stats.totalProgress += progress.progress_percent || 0;
        if (progress.status === 'completed') {
          stats.completedChapters++;
        }
      }

      // Add display names from profiles and filter by privacy
      const visibleUsers = new Set((profiles || []).map(p => p.user_id));
      for (const profile of (profiles || [])) {
        if (userScores.has(profile.user_id)) {
          userScores.get(profile.user_id)!.displayName = profile.display_name || 'Anonymous';
        }
      }

      // Calculate combined scores and create leaderboard entries
      const entries: SubjectLeaderboardEntry[] = [];
      for (const [userId, stats] of userScores) {
        // Skip users who opted out of leaderboard
        if (!visibleUsers.has(userId)) continue;
        // Skip users with no data
        if (stats.quizCount === 0 && stats.chapterCount === 0) continue;

        const quizAvg = stats.quizCount > 0 ? stats.quizTotalScore / stats.quizCount : 0;
        const progressAvg = stats.chapterCount > 0 ? stats.totalProgress / stats.chapterCount : 0;
        
        // Combined score: 50% quiz performance + 50% chapter progress
        const combinedScore = (quizAvg * 0.5) + (progressAvg * 0.5);

        entries.push({
          rank: 0, // Will be set after sorting
          user_id: userId,
          display_name: stats.displayName,
          score: Math.round(combinedScore * 10) / 10,
          quiz_avg: Math.round(quizAvg),
          quiz_count: stats.quizCount,
          chapters_completed: stats.completedChapters,
          chapters_total: stats.chapterCount,
          progress_percent: Math.round(progressAvg),
        });
      }

      // Sort by score descending and assign ranks
      entries.sort((a, b) => b.score - a.score);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries.slice(0, limit);
    } catch (error) {
      logger.error({ error, classNum, subject }, 'Error getting subject leaderboard');
      return [];
    }
  }

  /**
   * Get weekly leaderboard
   * Rankings based on quiz performance in the current week
   */
  async getWeeklyLeaderboard(
    classNum: number,
    limit: number = 20
  ): Promise<{ entries: PeriodLeaderboardEntry[]; period_start: string; period_end: string }> {
    // Calculate current week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() + mondayOffset);
    periodStart.setHours(0, 0, 0, 0);
    
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);

    return this.getPeriodLeaderboard(classNum, periodStart, periodEnd, limit);
  }

  /**
   * Get monthly leaderboard
   * Rankings based on quiz performance in the current month
   */
  async getMonthlyLeaderboard(
    classNum: number,
    limit: number = 20
  ): Promise<{ entries: PeriodLeaderboardEntry[]; period_start: string; period_end: string }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getPeriodLeaderboard(classNum, periodStart, periodEnd, limit);
  }

  /**
   * Get period-based leaderboard (helper for weekly/monthly)
   */
  private async getPeriodLeaderboard(
    classNum: number,
    periodStart: Date,
    periodEnd: Date,
    limit: number
  ): Promise<{ entries: PeriodLeaderboardEntry[]; period_start: string; period_end: string }> {
    try {
      // Get quiz attempts in this period
      const { data: quizAttempts, error: quizError } = await supabase
        .from('quiz_attempts')
        .select('user_id, score_percent, created_at')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

      if (quizError) {
        logger.error({ error: quizError }, 'Failed to fetch quiz attempts for period leaderboard');
      }

      // Get chapter completions in this period
      const { data: completions, error: completionError } = await supabase
        .from('user_chapter_progress')
        .select('user_id, status, completed_at')
        .eq('class', classNum)
        .eq('status', 'completed')
        .gte('completed_at', periodStart.toISOString())
        .lte('completed_at', periodEnd.toISOString());

      if (completionError) {
        logger.error({ error: completionError }, 'Failed to fetch completions for period leaderboard');
      }

      // Get XP earned in this period
      const { data: xpTransactions, error: xpError } = await supabase
        .from('xp_transactions')
        .select('user_id, amount, created_at')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

      if (xpError) {
        logger.error({ error: xpError }, 'Failed to fetch XP transactions for period leaderboard');
      }

      // Get user profiles
      const { data: profiles, error: profileError } = await supabase
        .from('user_profile')
        .select('user_id, display_name, show_on_leaderboard')
        .eq('class', classNum)
        .eq('show_on_leaderboard', true);

      if (profileError) {
        logger.error({ error: profileError }, 'Failed to fetch profiles for period leaderboard');
      }

      // Aggregate data by user
      const userStats = new Map<string, {
        quizCount: number;
        quizTotalScore: number;
        perfectQuizzes: number;
        chaptersCompleted: number;
        xpEarned: number;
        displayName: string;
      }>();

      // Process quiz attempts
      for (const attempt of (quizAttempts || [])) {
        const userId = attempt.user_id;
        if (!userStats.has(userId)) {
          userStats.set(userId, {
            quizCount: 0,
            quizTotalScore: 0,
            perfectQuizzes: 0,
            chaptersCompleted: 0,
            xpEarned: 0,
            displayName: 'Anonymous',
          });
        }
        const stats = userStats.get(userId)!;
        stats.quizCount++;
        stats.quizTotalScore += attempt.score_percent || 0;
        if (attempt.score_percent === 100) {
          stats.perfectQuizzes++;
        }
      }

      // Process chapter completions
      for (const completion of (completions || [])) {
        const userId = completion.user_id;
        if (!userStats.has(userId)) {
          userStats.set(userId, {
            quizCount: 0,
            quizTotalScore: 0,
            perfectQuizzes: 0,
            chaptersCompleted: 0,
            xpEarned: 0,
            displayName: 'Anonymous',
          });
        }
        userStats.get(userId)!.chaptersCompleted++;
      }

      // Process XP transactions
      for (const xp of (xpTransactions || [])) {
        const userId = xp.user_id;
        if (userStats.has(userId)) {
          userStats.get(userId)!.xpEarned += xp.amount || 0;
        }
      }

      // Add display names and filter by privacy
      const visibleUsers = new Set((profiles || []).map(p => p.user_id));
      for (const profile of (profiles || [])) {
        if (userStats.has(profile.user_id)) {
          userStats.get(profile.user_id)!.displayName = profile.display_name || 'Anonymous';
        }
      }

      // Calculate scores and create entries
      const entries: PeriodLeaderboardEntry[] = [];
      for (const [userId, stats] of userStats) {
        if (!visibleUsers.has(userId)) continue;
        if (stats.quizCount === 0 && stats.chaptersCompleted === 0) continue;

        const quizAvg = stats.quizCount > 0 ? stats.quizTotalScore / stats.quizCount : 0;
        
        // Score formula:
        // - Quiz average: 40%
        // - Quiz count (capped at 20): 20%
        // - Perfect quizzes bonus: 15%
        // - Chapters completed (capped at 10): 15%
        // - XP earned (normalized): 10%
        const quizCountScore = Math.min(stats.quizCount / 20, 1) * 100;
        const perfectScore = Math.min(stats.perfectQuizzes / 5, 1) * 100;
        const chapterScore = Math.min(stats.chaptersCompleted / 10, 1) * 100;
        const xpScore = Math.min(stats.xpEarned / 500, 1) * 100;

        const combinedScore = 
          quizAvg * 0.40 +
          quizCountScore * 0.20 +
          perfectScore * 0.15 +
          chapterScore * 0.15 +
          xpScore * 0.10;

        entries.push({
          rank: 0,
          user_id: userId,
          display_name: stats.displayName,
          score: Math.round(combinedScore * 10) / 10,
          quiz_count: stats.quizCount,
          quiz_avg: Math.round(quizAvg),
          perfect_quizzes: stats.perfectQuizzes,
          chapters_completed: stats.chaptersCompleted,
          total_xp_earned: stats.xpEarned,
        });
      }

      // Sort and assign ranks
      entries.sort((a, b) => b.score - a.score);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return {
        entries: entries.slice(0, limit),
        period_start: periodStart.toISOString().split('T')[0]!,
        period_end: periodEnd.toISOString().split('T')[0]!,
      };
    } catch (error) {
      logger.error({ error, classNum }, 'Error getting period leaderboard');
      return {
        entries: [],
        period_start: periodStart.toISOString().split('T')[0]!,
        period_end: periodEnd.toISOString().split('T')[0]!,
      };
    }
  }

  /**
   * Create a leaderboard snapshot (for weekly/monthly archives)
   */
  async createSnapshot(
    classNum: number,
    periodType: 'weekly' | 'monthly' | 'all_time',
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    try {
      const { entries, total } = await this.getClassLeaderboard(classNum, 100, 0);

      const { error } = await supabase.from('leaderboard_snapshots').insert({
        class: classNum,
        period_type: periodType,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        rankings: entries,
        total_participants: total,
      });

      if (error) {
        logger.error({ error, classNum, periodType }, 'Failed to create snapshot');
        return;
      }

      logger.info({ classNum, periodType, total }, 'Leaderboard snapshot created');
    } catch (error) {
      logger.error({ error, classNum, periodType }, 'Error creating snapshot');
    }
  }

  /**
   * Get historical leaderboard snapshot
   */
  async getSnapshot(
    classNum: number,
    periodType: 'weekly' | 'monthly' | 'all_time',
    periodStart: Date
  ): Promise<{ rankings: LeaderboardEntry[]; total: number } | null> {
    try {
      const { data, error } = await supabase
        .from('leaderboard_snapshots')
        .select('rankings, total_participants')
        .eq('class', classNum)
        .eq('period_type', periodType)
        .eq('period_start', periodStart.toISOString().split('T')[0])
        .single();

      if (error || !data) {
        return null;
      }

      return {
        rankings: data.rankings as LeaderboardEntry[],
        total: data.total_participants,
      };
    } catch (error) {
      logger.error({ error, classNum, periodType }, 'Error getting snapshot');
      return null;
    }
  }
}

export const leaderboardService = new LeaderboardService();
