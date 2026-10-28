import { supabase } from '../db/supabase';
import { llmService } from './llm.service';
import { gamificationService, XP_AWARDS } from './gamification.service';
import { getChapterById, getSubjectByName } from '../data/curriculum';
import {
  getStudyPlanPrompt,
  getChapterPlanPrompt,
  getTopicPlanPrompt,
  type StudyPlan as StudyPlanStructure,
  type ChapterStudyPlan,
  type TopicStudyPlan,
  type ChapterInfo,
} from '../prompts/planner.prompts';
import { logger } from '../utils/logger';
import { NotFoundError, DatabaseError, ValidationError } from '../utils/apiError';
import type {
  GeneratePlanInput,
  GenerateChapterPlanInput,
  GenerateTopicPlanInput,
} from '../schemas/planner.schema';

// =============================================================================
// TYPES
// =============================================================================

export interface UserProfile {
  class: number;
  board: string;
  weak_topics?: string[];
  strong_topics?: string[];
}

export interface PlanTask {
  study_plan_id: string;
  user_id: string;
  task_type: string;
  subject: string;
  chapter: string | null;
  chapter_id: string | null;
  topic: string | null;
  duration_min: number;
  deadline?: string;
  scheduled_at?: string;
  status: string;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  study_dates: string[];
  last_study_date: string | null;
}

export interface PlanWithProgress {
  id: string;
  plan_date: string;
  subject: string | null;
  deadline: string | null;
  target_chapters: string[] | null;
  plan_meta: Record<string, unknown>;
  created_at: string;
  progress: {
    total_tasks: number;
    completed_tasks: number;
    completion_percent: number;
  };
  status: 'active' | 'completed' | 'overdue';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get user profile from database
 */
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const { data: profile, error } = await supabase
    .from('user_profile')
    .select('class, board, weak_topics, strong_topics')
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    throw new ValidationError('User profile not found. Please complete your profile first.');
  }

  return profile;
};

/**
 * Calculate study streak from completed tasks
 */
export const calculateStreak = async (userId: string): Promise<StreakData> => {
  // Get all completed tasks with their completion dates
  const { data: completedTasks, error } = await supabase
    .from('plan_tasks')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to fetch completed tasks for streak');
    throw new DatabaseError('Failed to calculate streak');
  }

  if (!completedTasks || completedTasks.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      study_dates: [],
      last_study_date: null,
    };
  }

  // Extract unique dates
  const studyDatesSet = new Set<string>();
  completedTasks.forEach((task) => {
    if (task.completed_at) {
      const date = new Date(task.completed_at).toISOString().split('T')[0];
      studyDatesSet.add(date!);
    }
  });

  const studyDates = Array.from(studyDatesSet).sort((a, b) => b.localeCompare(a)); // Most recent first
  const lastStudyDate = studyDates[0] || null;

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if studied today or yesterday to have an active streak
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (studyDates.includes(todayStr!) || studyDates.includes(yesterdayStr!)) {
    // Count consecutive days backwards
    let checkDate = studyDates.includes(todayStr!) ? new Date(today) : new Date(yesterday);
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (studyDates.includes(dateStr!)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  
  // Sort dates ascending for longest streak calculation
  const sortedDates = [...studyDates].sort((a, b) => a.localeCompare(b));
  
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prevDate = new Date(sortedDates[i - 1]!);
      const currDate = new Date(sortedDates[i]!);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    study_dates: studyDates,
    last_study_date: lastStudyDate,
  };
};

/**
 * Get all plans for a user grouped by subject with progress
 */
export const getAllPlansGroupedBySubject = async (
  userId: string
): Promise<Record<string, PlanWithProgress[]>> => {
  const { data: plans, error } = await supabase
    .from('study_plans')
    .select('id, plan_date, subject, deadline, target_chapters, plan_meta, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to fetch plans');
    throw new DatabaseError('Failed to fetch plans');
  }

  if (!plans || plans.length === 0) {
    return {};
  }

  // Get progress for each plan
  const plansWithProgress: PlanWithProgress[] = await Promise.all(
    plans.map(async (plan) => {
      const { data: tasks } = await supabase
        .from('plan_tasks')
        .select('status')
        .eq('study_plan_id', plan.id);

      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter((t) => t.status === 'completed').length || 0;
      const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const isOverdue = plan.deadline && new Date(plan.deadline) < new Date() && completionPercent < 100;
      const isCompleted = completionPercent === 100;

      return {
        id: plan.id,
        plan_date: plan.plan_date,
        subject: plan.subject || (plan.plan_meta as Record<string, unknown>)?.subject as string || 'General',
        deadline: plan.deadline,
        target_chapters: plan.target_chapters,
        plan_meta: plan.plan_meta as Record<string, unknown>,
        created_at: plan.created_at,
        progress: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          completion_percent: completionPercent,
        },
        status: isCompleted ? 'completed' : isOverdue ? 'overdue' : 'active',
      } as PlanWithProgress;
    })
  );

  // Group by subject
  const grouped: Record<string, PlanWithProgress[]> = {};
  for (const plan of plansWithProgress) {
    const subject = plan.subject || 'General';
    if (!grouped[subject]) {
      grouped[subject] = [];
    }
    grouped[subject]!.push(plan);
  }

  return grouped;
};

/**
 * Check if all tasks for a chapter are completed
 */
export const checkChapterCompletion = async (
  userId: string,
  planId: string,
  chapterId: string
): Promise<{ isComplete: boolean; completedTasks: number; totalTasks: number }> => {
  const { data: tasks, error } = await supabase
    .from('plan_tasks')
    .select('id, status')
    .eq('study_plan_id', planId)
    .eq('chapter_id', chapterId);

  if (error) {
    logger.error({ error }, 'Failed to check chapter completion');
    throw new DatabaseError('Failed to check chapter completion');
  }

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.status === 'completed').length || 0;

  return {
    isComplete: totalTasks > 0 && completedTasks === totalTasks,
    completedTasks,
    totalTasks,
  };
};

/**
 * Mark chapter as complete in user_chapter_progress
 */
export const markChapterComplete = async (
  userId: string,
  chapterId: string
): Promise<void> => {
  const chapterInfo = getChapterById(chapterId);
  if (!chapterInfo) {
    logger.warn({ chapterId }, 'Chapter not found in curriculum');
    return;
  }

  const { error } = await supabase.from('user_chapter_progress').upsert(
    {
      user_id: userId,
      chapter_id: chapterId,
      class: chapterInfo.classNum,
      subject: chapterInfo.subject.name,
      chapter_name: chapterInfo.chapter.name,
      progress_percent: 100,
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_studied_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,chapter_id' }
  );

  if (error) {
    logger.error({ error, userId, chapterId }, 'Failed to mark chapter complete');
  } else {
    logger.info({ userId, chapterId }, 'Chapter marked as complete');
    // Award XP for chapter completion
    await gamificationService.awardXP(userId, XP_AWARDS.CHAPTER_COMPLETE, 'chapter_complete', chapterId);
  }
};

// =============================================================================
// TOPIC-WISE PLAN GENERATION
// =============================================================================

/**
 * Generate a topic-wise study plan for a single chapter
 */
export const generateTopicPlan = async (
  userId: string,
  input: GenerateTopicPlanInput
): Promise<{
  plan: {
    id: string;
    subject: string;
    chapter_id: string;
    chapter_name: string;
    deadline: string;
    total_topics: number;
    created_at: string;
  };
  structure: TopicStudyPlan;
  warnings: string[];
}> => {
  logger.info({ userId, subject: input.subject, chapter: input.chapter_id }, 'Generating topic-wise plan');

  // Get user profile
  const profile = await getUserProfile(userId);

  // Get chapter info
  const chapterData = getChapterById(input.chapter_id);
  if (!chapterData) {
    throw new ValidationError(`Chapter '${input.chapter_id}' not found in curriculum`);
  }

  if (chapterData.classNum !== profile.class) {
    throw new ValidationError(
      `Chapter '${input.chapter_id}' is for class ${chapterData.classNum}, but you are in class ${profile.class}`
    );
  }

  // Validate deadline
  const deadline = new Date(input.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (deadline <= today) {
    throw new ValidationError('Deadline must be in the future');
  }

  const daysAvailable = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const totalHoursAvailable = daysAvailable * input.daily_study_hours;

  // Get existing progress for this chapter
  const { data: progressData } = await supabase
    .from('user_chapter_progress')
    .select('progress_percent')
    .eq('user_id', userId)
    .eq('chapter_id', input.chapter_id)
    .single();

  // Prepare topics with priorities
  const topics = chapterData.chapter.topics.map((topic, index) => ({
    name: topic,
    order: index + 1,
    is_priority: input.priority_topics?.includes(topic) || false,
  }));

  // Generate plan with AI
  const systemPrompt = 'You are an expert study planner for Indian school students. Create topic-wise study schedules aligned with NCERT curriculum.';
  const userPrompt = getTopicPlanPrompt({
    studentClass: profile.class,
    board: profile.board,
    subject: input.subject,
    chapter: {
      id: chapterData.chapter.id,
      name: chapterData.chapter.name,
      description: chapterData.chapter.description,
      topics,
      estimated_hours: chapterData.chapter.estimated_hours,
      weightage: chapterData.chapter.weightage,
      progress_percent: progressData?.progress_percent || 0,
    },
    deadline: input.deadline,
    dailyStudyHours: input.daily_study_hours,
    includeQuiz: input.include_quiz !== false,
    currentDate: new Date().toISOString(),
  });

  logger.info({ promptLength: userPrompt.length }, 'Generating topic plan with AI (using planner model)');

  const planStructure = await llmService.generateJSON<TopicStudyPlan>(
    systemPrompt,
    userPrompt,
    {
      temperature: 0.7,
      maxTokens: 4000,
      usePlannerModel: true, // Use gpt-5/gpt-4o for better quality plans
    }
  );

  logger.info({ totalDays: planStructure.total_days, topics: planStructure.topics?.length }, 'Topic plan generated');

  // Use deadline as plan_date to avoid collision with other plans created today
  const planDate = input.deadline.split('T')[0];

  // Check if a plan already exists for this user + plan_date, delete it if so (replace mode)
  const { data: existingPlan } = await supabase
    .from('study_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .single();

  if (existingPlan) {
    logger.info({ existingPlanId: existingPlan.id }, 'Deleting existing plan for same date (replace mode)');
    await supabase.from('study_plans').delete().eq('id', existingPlan.id);
  }

  // Save study plan
  const { data: studyPlan, error: planError } = await supabase
    .from('study_plans')
    .insert({
      user_id: userId,
      plan_date: planDate,
      subject: input.subject,
      deadline: planDate,
      target_chapters: [input.chapter_id],
      generated_by: 'system',
      plan_meta: {
        type: 'topic_plan',
        title: planStructure.title,
        chapter_id: input.chapter_id,
        chapter_name: chapterData.chapter.name,
        total_days: planStructure.total_days,
        total_topics: planStructure.total_topics,
        daily_hours: planStructure.daily_hours,
        topics: planStructure.topics,
        include_quiz: input.include_quiz !== false,
      },
    })
    .select()
    .single();

  if (planError) {
    logger.error({ error: planError }, 'Failed to save topic plan');
    throw new DatabaseError('Failed to save topic plan');
  }

  // Create plan tasks from topics
  const tasks: PlanTask[] = [];

  if (planStructure.topics) {
    for (const topicSchedule of planStructure.topics) {
      const scheduledDate = new Date(today);
      scheduledDate.setDate(scheduledDate.getDate() + topicSchedule.day - 1);

      tasks.push({
        study_plan_id: studyPlan.id,
        user_id: userId,
        task_type: 'study',
        subject: input.subject,
        chapter: chapterData.chapter.name,
        chapter_id: input.chapter_id,
        topic: topicSchedule.topic_name,
        duration_min: topicSchedule.estimated_minutes,
        deadline: scheduledDate.toISOString().split('T')[0],
        scheduled_at: scheduledDate.toISOString(),
        status: 'pending',
      });
    }
  }

  // Add quiz task at the end if enabled
  if (input.include_quiz !== false && planStructure.quiz_day) {
    const quizDate = new Date(today);
    quizDate.setDate(quizDate.getDate() + planStructure.quiz_day - 1);

    tasks.push({
      study_plan_id: studyPlan.id,
      user_id: userId,
      task_type: 'quiz',
      subject: input.subject,
      chapter: chapterData.chapter.name,
      chapter_id: input.chapter_id,
      topic: `Quiz: ${chapterData.chapter.name}`,
      duration_min: 30,
      deadline: quizDate.toISOString().split('T')[0],
      scheduled_at: quizDate.toISOString(),
      status: 'pending',
    });
  }

  if (tasks.length > 0) {
    const { error: tasksError } = await supabase.from('plan_tasks').insert(tasks);
    if (tasksError) {
      logger.error({ error: tasksError }, 'Failed to save plan tasks');
    }
  }

  // Award XP for creating a plan
  await gamificationService.awardXP(userId, 25, 'plan_created', studyPlan.id, 'Created topic-wise study plan');

  logger.info({ planId: studyPlan.id, taskCount: tasks.length }, 'Topic plan and tasks saved');

  const warnings: string[] = [];
  if (chapterData.chapter.estimated_hours > totalHoursAvailable) {
    warnings.push(
      `Time may be tight: ${chapterData.chapter.estimated_hours} hours recommended, ${totalHoursAvailable} hours available`
    );
  }

  return {
    plan: {
      id: studyPlan.id,
      subject: input.subject,
      chapter_id: input.chapter_id,
      chapter_name: chapterData.chapter.name,
      deadline: input.deadline,
      total_topics: topics.length,
      created_at: studyPlan.created_at,
    },
    structure: planStructure,
    warnings,
  };
};

// =============================================================================
// EXPORT SERVICE
// =============================================================================

export const plannerService = {
  getUserProfile,
  calculateStreak,
  getAllPlansGroupedBySubject,
  checkChapterCompletion,
  markChapterComplete,
  generateTopicPlan,
};
