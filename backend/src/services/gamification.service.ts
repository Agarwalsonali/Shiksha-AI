import { supabase } from '../db/supabase';
import { logger } from '../utils/logger';

/**
 * XP Award Configuration
 */
export const XP_AWARDS = {
  CHAPTER_COMPLETE: 50,
  CHAPTER_START: 10,
  QUIZ_PASS: 20,       // 60%+
  QUIZ_ACE: 50,        // 100%
  QUIZ_GOOD: 30,       // 80%+
  DAILY_LOGIN: 5,
  STREAK_7: 50,
  STREAK_30: 150,
  STREAK_100: 500,
  PLAN_TASK_COMPLETE: 10,
  ADD_REVISION_TAG: 5,
  ADD_NOTES: 5,
} as const;

/**
 * Badge criteria types
 */
interface BadgeCriteria {
  type: string;
  value?: number;
  condition?: string;
}

/**
 * Badge definition
 */
interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  xp_reward: number;
  criteria: BadgeCriteria;
}

/**
 * User badge
 */
interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge: BadgeDefinition;
}

/**
 * XP and level info
 */
interface UserXP {
  total_xp: number;
  level: number;
  xp_to_next_level: number;
  xp_in_current_level: number;
}

/**
 * Gamification Service
 * Handles XP awards, badges, and achievement tracking
 */
class GamificationService {
  /**
   * Award XP to a user
   */
  async awardXP(
    userId: string,
    amount: number,
    source: string,
    sourceId?: string,
    description?: string
  ): Promise<{ newTotalXP: number; newLevel: number; levelUp: boolean }> {
    try {
      // Use database function to award XP
      const { data, error } = await supabase.rpc('award_xp', {
        p_user_id: userId,
        p_amount: amount,
        p_source: source,
        p_source_id: sourceId || null,
        p_description: description || null,
      });

      if (error) {
        logger.error({ error, userId, amount, source }, 'Failed to award XP via RPC');
        // Fallback to manual update
        return this.awardXPManual(userId, amount, source, sourceId, description);
      }

      const result = data[0];
      
      logger.info(
        { userId, amount, source, newLevel: result.new_level, levelUp: result.level_up },
        'XP awarded'
      );

      return {
        newTotalXP: result.new_total_xp,
        newLevel: result.new_level,
        levelUp: result.level_up,
      };
    } catch (error) {
      logger.error({ error, userId, amount, source }, 'Error awarding XP');
      return this.awardXPManual(userId, amount, source, sourceId, description);
    }
  }

  /**
   * Manual XP award (fallback if RPC fails)
   */
  private async awardXPManual(
    userId: string,
    amount: number,
    source: string,
    sourceId?: string,
    description?: string
  ): Promise<{ newTotalXP: number; newLevel: number; levelUp: boolean }> {
    // Get current XP
    const { data: currentXP } = await supabase
      .from('user_xp')
      .select('total_xp, level')
      .eq('user_id', userId)
      .single();

    const oldLevel = currentXP?.level || 1;
    const oldTotalXP = currentXP?.total_xp || 0;
    const newTotalXP = oldTotalXP + amount;

    // Calculate new level
    const { level: newLevel, xpToNext } = this.calculateLevel(newTotalXP);

    // Insert transaction
    await supabase.from('xp_transactions').insert({
      user_id: userId,
      amount,
      source,
      source_id: sourceId,
      description,
    });

    // Upsert user_xp
    await supabase.from('user_xp').upsert(
      {
        user_id: userId,
        total_xp: newTotalXP,
        level: newLevel,
        xp_to_next_level: xpToNext,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return {
      newTotalXP,
      newLevel,
      levelUp: newLevel > oldLevel,
    };
  }

  /**
   * Calculate level from total XP
   * Formula: Each level requires 100 * level XP
   * Level 1: 0-99 XP
   * Level 2: 100-299 XP (needs 200 more)
   * Level 3: 300-599 XP (needs 300 more)
   * etc.
   */
  calculateLevel(totalXP: number): { level: number; xpToNext: number; xpInCurrentLevel: number } {
    let level = 1;
    let xpNeeded = 100;
    let remainingXP = totalXP;

    while (remainingXP >= xpNeeded) {
      remainingXP -= xpNeeded;
      level++;
      xpNeeded = 100 * level;
    }

    return {
      level,
      xpToNext: xpNeeded - remainingXP,
      xpInCurrentLevel: remainingXP,
    };
  }

  /**
   * Get user's XP and level
   */
  async getUserXP(userId: string): Promise<UserXP> {
    const { data, error } = await supabase
      .from('user_xp')
      .select('total_xp, level, xp_to_next_level')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        total_xp: 0,
        level: 1,
        xp_to_next_level: 100,
        xp_in_current_level: 0,
      };
    }

    const { xpInCurrentLevel } = this.calculateLevel(data.total_xp);

    return {
      total_xp: data.total_xp,
      level: data.level,
      xp_to_next_level: data.xp_to_next_level,
      xp_in_current_level: xpInCurrentLevel,
    };
  }

  /**
   * Get user's XP transaction history
   */
  async getXPHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ transactions: any[]; total: number }> {
    const { data, error, count } = await supabase
      .from('xp_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error, userId }, 'Failed to fetch XP history');
      return { transactions: [], total: 0 };
    }

    return { transactions: data || [], total: count || 0 };
  }

  /**
   * Check and award badges for a user
   * Returns newly awarded badges
   */
  async checkAndAwardBadges(userId: string): Promise<BadgeDefinition[]> {
    const newBadges: BadgeDefinition[] = [];

    try {
      // Get all badge definitions
      const { data: badges, error: badgesError } = await supabase
        .from('badge_definitions')
        .select('*')
        .eq('is_active', true);

      if (badgesError || !badges) {
        logger.error({ error: badgesError }, 'Failed to fetch badge definitions');
        return [];
      }

      // Get user's existing badges
      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      const earnedBadgeIds = new Set((userBadges || []).map((b) => b.badge_id));

      // Get user stats for badge criteria
      const stats = await this.getUserStatsForBadges(userId);

      // Check each badge
      for (const badge of badges) {
        if (earnedBadgeIds.has(badge.id)) continue;

        const criteria = badge.criteria as BadgeCriteria;
        const earned = this.checkBadgeCriteria(criteria, stats);

        if (earned) {
          // Award badge
          const { error: awardError } = await supabase.from('user_badges').insert({
            user_id: userId,
            badge_id: badge.id,
          });

          if (!awardError) {
            newBadges.push(badge);

            // Award XP for badge
            if (badge.xp_reward > 0) {
              await this.awardXP(
                userId,
                badge.xp_reward,
                'badge',
                badge.id,
                `Earned badge: ${badge.name}`
              );
            }

            logger.info({ userId, badgeId: badge.id, badgeName: badge.name }, 'Badge awarded');
          }
        }
      }

      return newBadges;
    } catch (error) {
      logger.error({ error, userId }, 'Error checking badges');
      return [];
    }
  }

  /**
   * Get user stats needed for badge criteria
   */
  private async getUserStatsForBadges(userId: string): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    // Get chapter progress stats
    const { data: progressData } = await supabase
      .from('user_chapter_progress')
      .select('status, system_tags, notes')
      .eq('user_id', userId);

    if (progressData) {
      stats.chapters_completed = progressData.filter((p) => p.status === 'completed').length;
      stats.chapters_in_progress = progressData.filter((p) => p.status === 'in_progress').length;
      stats.revision_tags = progressData.filter((p) => p.system_tags?.includes('need_revision')).length;
      stats.chapters_with_notes = progressData.filter((p) => p.notes && p.notes.length > 0).length;
    }

    // Get quiz stats
    const { data: quizData } = await supabase
      .from('quiz_attempts')
      .select('score_percent')
      .eq('user_id', userId);

    if (quizData) {
      stats.quizzes_taken = quizData.length;
      stats.perfect_quizzes = quizData.filter((q) => q.score_percent === 100).length;
      stats.quizzes_80_plus = quizData.filter((q) => q.score_percent >= 80).length;
    }

    // Get streak stats
    const { data: streakData } = await supabase
      .from('user_streaks')
      .select('current_streak_days, longest_streak_days')
      .eq('user_id', userId)
      .single();

    if (streakData) {
      stats.current_streak = streakData.current_streak_days || 0;
      stats.longest_streak = streakData.longest_streak_days || 0;
    }

    // Get XP and level
    const { data: xpData } = await supabase
      .from('user_xp')
      .select('total_xp, level')
      .eq('user_id', userId)
      .single();

    if (xpData) {
      stats.total_xp = xpData.total_xp || 0;
      stats.level = xpData.level || 1;
    }

    // Get study plans
    const { data: plansData } = await supabase
      .from('study_plans')
      .select('id')
      .eq('user_id', userId);

    stats.plans_created = plansData?.length || 0;

    return stats;
  }

  /**
   * Check if badge criteria is met
   */
  private checkBadgeCriteria(criteria: BadgeCriteria, stats: Record<string, any>): boolean {
    switch (criteria.type) {
      case 'chapters_completed':
        return (stats.chapters_completed || 0) >= (criteria.value || 0);

      case 'quizzes_taken':
        return (stats.quizzes_taken || 0) >= (criteria.value || 0);

      case 'perfect_quiz':
        return (stats.perfect_quizzes || 0) >= (criteria.value || 0);

      case 'perfect_quizzes':
        return (stats.perfect_quizzes || 0) >= (criteria.value || 0);

      case 'quiz_streak_80':
        return (stats.quizzes_80_plus || 0) >= (criteria.value || 0);

      case 'streak_days':
        return (stats.current_streak || 0) >= (criteria.value || 0);

      case 'revision_tags':
        return (stats.revision_tags || 0) >= (criteria.value || 0);

      case 'chapters_with_notes':
        return (stats.chapters_with_notes || 0) >= (criteria.value || 0);

      case 'plans_created':
        return (stats.plans_created || 0) >= (criteria.value || 0);

      case 'level_reached':
        return (stats.level || 1) >= (criteria.value || 0);

      case 'study_hours':
        return (stats.study_hours || 0) >= (criteria.value || 0);

      case 'subject_completed':
        // This needs more complex logic - check if any subject has all chapters completed
        return false; // TODO: Implement

      default:
        return false;
    }
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        id,
        badge_id,
        earned_at,
        badge:badge_definitions (
          id,
          name,
          description,
          icon,
          category,
          tier,
          xp_reward,
          criteria
        )
      `)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) {
      logger.error({ error, userId }, 'Failed to fetch user badges');
      return [];
    }

    return (data || []).map((b: any) => ({
      id: b.id,
      badge_id: b.badge_id,
      earned_at: b.earned_at,
      badge: b.badge,
    }));
  }

  /**
   * Get all available badges
   */
  async getAllBadges(): Promise<BadgeDefinition[]> {
    const { data, error } = await supabase
      .from('badge_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error({ error }, 'Failed to fetch all badges');
      return [];
    }

    return data || [];
  }

  /**
   * Get badge progress for user (how close they are to earning each badge)
   */
  async getBadgeProgress(userId: string): Promise<Array<{
    badge: BadgeDefinition;
    earned: boolean;
    progress: number;
    current: number;
    required: number;
  }>> {
    const badges = await this.getAllBadges();
    const userBadges = await this.getUserBadges(userId);
    const earnedIds = new Set(userBadges.map((b) => b.badge_id));
    const stats = await this.getUserStatsForBadges(userId);

    return badges.map((badge) => {
      const earned = earnedIds.has(badge.id);
      const criteria = badge.criteria as BadgeCriteria;
      const { current, required } = this.getBadgeCriteriaProgress(criteria, stats);
      const progress = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;

      return {
        badge,
        earned,
        progress: earned ? 100 : progress,
        current,
        required,
      };
    });
  }

  /**
   * Get current progress towards a badge criterion
   */
  private getBadgeCriteriaProgress(
    criteria: BadgeCriteria,
    stats: Record<string, any>
  ): { current: number; required: number } {
    const required = criteria.value || 0;

    switch (criteria.type) {
      case 'chapters_completed':
        return { current: stats.chapters_completed || 0, required };
      case 'quizzes_taken':
        return { current: stats.quizzes_taken || 0, required };
      case 'perfect_quiz':
      case 'perfect_quizzes':
        return { current: stats.perfect_quizzes || 0, required };
      case 'streak_days':
        return { current: stats.current_streak || 0, required };
      case 'revision_tags':
        return { current: stats.revision_tags || 0, required };
      case 'chapters_with_notes':
        return { current: stats.chapters_with_notes || 0, required };
      case 'plans_created':
        return { current: stats.plans_created || 0, required };
      case 'level_reached':
        return { current: stats.level || 1, required };
      default:
        return { current: 0, required };
    }
  }
}

export const gamificationService = new GamificationService();
