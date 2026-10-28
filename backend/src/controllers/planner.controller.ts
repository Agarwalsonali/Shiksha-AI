import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse } from '../utils/apiResponse';
import { NotFoundError, DatabaseError, ValidationError } from '../utils/apiError';
import { llmService } from '../services/llm.service';
import {
  getStudyPlanPrompt,
  getChapterPlanPrompt,
  type StudyPlan as StudyPlanStructure,
  type ChapterStudyPlan,
  type ChapterInfo,
} from '../prompts/planner.prompts';
import { logger } from '../utils/logger';
import { getChapterById, getSubjectByName } from '../data/curriculum';
import { gamificationService, XP_AWARDS } from '../services/gamification.service';
import { plannerService } from '../services/planner.service';
import type {
  GeneratePlanInput,
  GenerateChapterPlanInput,
  GenerateTopicPlanInput,
  GetPlanInput,
  UpdateTaskStatusInput,
  UpdateChapterTaskInput,
  ListPlansInput,
  GetProgressInput,
  GetPlansByDeadlineInput,
  GetTodayTasksInput,
  GetAllPlansInput,
} from '../schemas/planner.schema';

/**
 * Generate a new study plan with AI
 * POST /api/planner/generate
 */
export const generatePlan = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as GeneratePlanInput;

  logger.info({ userId, input }, 'Generating study plan');

  try {
    // Get user profile for class and board
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class, board, weak_topics, strong_topics')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found. Please complete your profile first.');
    }

    // Merge user-provided topics with profile topics
    const weakTopics = [
      ...(input.weak_topics || []),
      ...(profile.weak_topics || []),
    ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

    const strongTopics = [
      ...(input.strong_topics || []),
      ...(profile.strong_topics || []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    // Generate study plan with AI
    const systemPrompt = 'You are an expert study planner for Indian school students. Create comprehensive, realistic study plans aligned with NCERT curriculum.';
    const userPrompt = getStudyPlanPrompt({
      studentClass: profile.class,
      board: profile.board,
      subject: input.subject,
      examDate: input.exam_date,
      weakTopics,
      strongTopics,
      dailyStudyHours: input.daily_study_hours,
      currentDate: new Date().toISOString(),
    });

    logger.info({ operation: 'plan-generation', promptLength: userPrompt.length }, 'Generating plan with AI (using planner model)');

    // Generate plan as JSON
    const planStructure = await llmService.generateJSON<StudyPlanStructure>(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.7,
        maxTokens: 4000,
        usePlannerModel: true, // Use gpt-5/gpt-4o for better quality plans
      }
    );

    logger.info({ phases: planStructure.phases.length, totalDays: planStructure.total_days }, 'Study plan generated');

    // Use exam_date as plan_date to avoid collision with other plans created today
    const planDate = input.exam_date.split('T')[0];

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

    // Save study plan to database
    const { data: studyPlan, error: planError } = await supabase
      .from('study_plans')
      .insert({
        user_id: userId,
        plan_date: planDate,
        generated_by: 'system',
        plan_meta: {
          title: planStructure.title,
          total_days: planStructure.total_days,
          daily_hours: planStructure.daily_hours,
          subject: input.subject,
          exam_date: input.exam_date,
          phases: planStructure.phases,
          weak_topics: weakTopics,
          strong_topics: strongTopics,
        },
      })
      .select()
      .single();

    if (planError) {
      logger.error({ error: planError }, 'Failed to save study plan');
      throw new DatabaseError('Failed to save study plan');
    }

    // Create plan tasks from the generated plan
    const tasks: any[] = [];
    planStructure.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        tasks.push({
          study_plan_id: studyPlan.id,
          user_id: userId,
          task_type: 'study', // Default type
          subject: input.subject,
          chapter: task.topics[0] || null,
          topic: task.topics.join(', '),
          duration_min: Math.round(task.estimated_hours * 60),
          status: 'pending',
        });
      });
    });

    if (tasks.length > 0) {
      const { error: tasksError } = await supabase
        .from('plan_tasks')
        .insert(tasks);

      if (tasksError) {
        logger.error({ error: tasksError }, 'Failed to save plan tasks');
        // Don't throw - plan is saved, tasks can be regenerated
      }
    }

    logger.info({ planId: studyPlan.id, taskCount: tasks.length }, 'Study plan and tasks saved');

    res.json(
      successResponse({
        plan: {
          id: studyPlan.id,
          plan_date: studyPlan.plan_date,
          subject: input.subject,
          exam_date: input.exam_date,
          created_at: studyPlan.created_at,
        },
        structure: planStructure,
      })
    );
  } catch (error) {
    logger.error({ error, userId, input }, 'Study plan generation failed');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to generate study plan');
  }
};

/**
 * Get study plan for a specific date
 * GET /api/planner/plan
 */
export const getPlan = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetPlanInput;

  try {
    const planDate = input.date ? new Date(input.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Get study plan
    const { data: plan, error: planError } = await supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .single();

    if (planError || !plan) {
      throw new NotFoundError('No study plan found for this date');
    }

    // Get associated tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('study_plan_id', plan.id)
      .order('created_at', { ascending: true });

    if (tasksError) {
      logger.error({ error: tasksError }, 'Failed to fetch plan tasks');
      throw new DatabaseError('Failed to fetch plan tasks');
    }

    res.json(
      successResponse({
        plan: {
          id: plan.id,
          plan_date: plan.plan_date,
          generated_by: plan.generated_by,
          created_at: plan.created_at,
          plan_meta: plan.plan_meta,
        },
        tasks: tasks || [],
      })
    );
  } catch (error) {
    logger.error({ error, userId, date: input.date }, 'Failed to get study plan');
    if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get study plan');
  }
};

/**
 * Update task status (complete, skip, etc.)
 * PATCH /api/planner/task/:task_id
 */
export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { task_id } = req.params;
  const input = req.body as UpdateTaskStatusInput;

  logger.info({ userId, taskId: task_id, newStatus: input.status }, 'Updating task status');

  try {
    // Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from('plan_tasks')
      .select('id, user_id')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      throw new NotFoundError('Task not found');
    }

    if (task.user_id !== userId) {
      throw new ValidationError('Access denied');
    }

    // Update task status
    const updateData: any = {
      status: input.status,
    };

    if (input.status === 'completed' && input.completed_at) {
      updateData.completed_at = input.completed_at;
    } else if (input.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('plan_tasks')
      .update(updateData)
      .eq('id', task_id)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to update task');
      throw new DatabaseError('Failed to update task');
    }

    logger.info({ taskId: task_id, newStatus: input.status }, 'Task status updated');

    res.json(
      successResponse({
        task: updatedTask,
      })
    );
  } catch (error) {
    logger.error({ error, userId, taskId: task_id }, 'Failed to update task status');
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update task status');
  }
};

/**
 * List all study plans for user
 * GET /api/planner/plans
 */
export const listPlans = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as ListPlansInput;

  try {
    let query = supabase
      .from('study_plans')
      .select('id, plan_date, plan_meta, generated_by, created_at', {
        count: 'exact',
      })
      .eq('user_id', userId)
      .order('plan_date', { ascending: false });

    // Apply subject filter if provided
    if (input.subject) {
      query = query.contains('plan_meta', { subject: input.subject });
    }

    // Pagination
    const from = (input.page - 1) * input.limit;
    const to = from + input.limit - 1;
    query = query.range(from, to);

    const { data: plans, error, count } = await query;

    if (error) {
      logger.error({ error }, 'Failed to list study plans');
      throw new DatabaseError('Failed to list study plans');
    }

    res.json(
      successResponse({
        plans: (plans || []).map((p) => ({
          id: p.id,
          plan_date: p.plan_date,
          subject: p.plan_meta?.subject,
          title: p.plan_meta?.title,
          total_days: p.plan_meta?.total_days,
          generated_by: p.generated_by,
          created_at: p.created_at,
        })),
        pagination: {
          page: input.page,
          limit: input.limit,
          total: count || 0,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to list study plans');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to list study plans');
  }
};

/**
 * Get study plan progress
 * GET /api/planner/progress
 */
export const getProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.query as unknown as GetProgressInput;

  try {
    let planId = input.plan_id;

    // If no plan_id provided, get plan for date (or today)
    if (!planId) {
      const planDate = input.date ? new Date(input.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const { data: plan } = await supabase
        .from('study_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('plan_date', planDate)
        .single();

      if (!plan) {
        throw new NotFoundError('No study plan found');
      }

      planId = plan.id;
    }

    // Get all tasks for this plan
    const { data: tasks, error: tasksError } = await supabase
      .from('plan_tasks')
      .select('id, status, duration_min, topic')
      .eq('study_plan_id', planId);

    if (tasksError) {
      logger.error({ error: tasksError }, 'Failed to fetch tasks');
      throw new DatabaseError('Failed to fetch tasks');
    }

    if (!tasks || tasks.length === 0) {
      return res.json(
        successResponse({
          progress: {
            total_tasks: 0,
            completed_tasks: 0,
            pending_tasks: 0,
            skipped_tasks: 0,
            in_progress_tasks: 0,
            completion_percentage: 0,
            total_minutes: 0,
            completed_minutes: 0,
          },
        })
      );
    }

    // Calculate progress
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const skippedTasks = tasks.filter((t) => t.status === 'skipped').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const completionPercentage = Math.round((completedTasks / totalTasks) * 100);

    const totalMinutes = tasks.reduce((sum, t) => sum + (t.duration_min || 0), 0);
    const completedMinutes = tasks
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.duration_min || 0), 0);

    res.json(
      successResponse({
        progress: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          pending_tasks: pendingTasks,
          skipped_tasks: skippedTasks,
          in_progress_tasks: inProgressTasks,
          completion_percentage: completionPercentage,
          total_minutes: totalMinutes,
          completed_minutes: completedMinutes,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get progress');
    if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get progress');
  }
};

/**
 * Delete study plan
 * DELETE /api/planner/plan/:plan_id
 */
export const deletePlan = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { plan_id } = req.params;

  try {
    // Verify ownership and delete
    const { error } = await supabase
      .from('study_plans')
      .delete()
      .eq('id', plan_id)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error }, 'Failed to delete study plan');
      throw new DatabaseError('Failed to delete study plan');
    }

    logger.info({ userId, planId: plan_id }, 'Study plan deleted');

    res.json(successResponse({ message: 'Study plan deleted successfully' }));
  } catch (error) {
    logger.error({ error, userId, planId: plan_id }, 'Failed to delete study plan');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to delete study plan');
  }
};

// =============================================================================
// CHAPTER-WISE PLANNING
// =============================================================================

/**
 * Generate a chapter-wise study plan
 * POST /api/planner/generate-chapter-plan
 */
export const generateChapterPlan = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as GenerateChapterPlanInput;

  logger.info({ userId, subject: input.subject, chapters: input.chapter_ids.length }, 'Generating chapter-wise plan');

  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class, board')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found. Please complete your profile first.');
    }

    // Validate and get chapter info
    const chapters: ChapterInfo[] = [];
    const prioritySet = new Set(input.priority_chapters || []);

    for (const chapterId of input.chapter_ids) {
      const chapterData = getChapterById(chapterId);
      if (!chapterData) {
        throw new ValidationError(`Chapter '${chapterId}' not found in curriculum`);
      }
      if (chapterData.classNum !== profile.class) {
        throw new ValidationError(`Chapter '${chapterId}' is for class ${chapterData.classNum}, but you are in class ${profile.class}`);
      }

      // Get existing progress
      const { data: progressData } = await supabase
        .from('user_chapter_progress')
        .select('progress_percent')
        .eq('user_id', userId)
        .eq('chapter_id', chapterId)
        .single();

      chapters.push({
        id: chapterData.chapter.id,
        name: chapterData.chapter.name,
        subject: chapterData.subject.name,
        estimated_hours: chapterData.chapter.estimated_hours,
        weightage: chapterData.chapter.weightage,
        order: chapterData.chapter.order,
        is_priority: prioritySet.has(chapterId),
        progress_percent: progressData?.progress_percent || 0,
      });
    }

    // Validate deadline
    const deadline = new Date(input.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deadline <= today) {
      throw new ValidationError('Deadline must be in the future');
    }

    const daysAvailable = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const totalHoursNeeded = chapters.reduce((sum, ch) => sum + ch.estimated_hours, 0);
    const totalHoursAvailable = daysAvailable * input.daily_study_hours;

    if (totalHoursNeeded > totalHoursAvailable * 1.5) {
      logger.warn({ totalHoursNeeded, totalHoursAvailable }, 'Tight schedule warning');
    }

    // Generate plan with AI
    const systemPrompt = 'You are an expert study planner for Indian school students. Create structured, chapter-wise study plans aligned with NCERT curriculum.';
    const userPrompt = getChapterPlanPrompt({
      studentClass: profile.class,
      board: profile.board,
      subject: input.subject,
      chapters,
      deadline: input.deadline,
      dailyStudyHours: input.daily_study_hours,
      includeRevision: input.include_revision,
      revisionDays: input.revision_days,
      currentDate: new Date().toISOString(),
    });

    logger.info({ promptLength: userPrompt.length }, 'Generating chapter plan with AI (using planner model)');

    const planStructure = await llmService.generateJSON<ChapterStudyPlan>(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.7,
        maxTokens: 6000,
        usePlannerModel: true, // Use gpt-5/gpt-4o for better quality plans
      }
    );

    logger.info({ totalDays: planStructure.total_days, scheduleItems: planStructure.schedule?.length }, 'Chapter plan generated');

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
        target_chapters: input.chapter_ids,
        generated_by: 'system',
        plan_meta: {
          type: 'chapter_plan',
          title: planStructure.title,
          total_days: planStructure.total_days,
          total_chapters: planStructure.total_chapters,
          daily_hours: planStructure.daily_hours,
          schedule: planStructure.schedule,
          revision_schedule: planStructure.revision_schedule,
          include_revision: input.include_revision,
          priority_chapters: input.priority_chapters,
        },
      })
      .select()
      .single();

    if (planError) {
      logger.error({ error: planError }, 'Failed to save chapter plan');
      throw new DatabaseError('Failed to save chapter plan');
    }

    // Create plan tasks from schedule
    const tasks: any[] = [];
    
    if (planStructure.schedule) {
      for (const daySchedule of planStructure.schedule) {
        // Calculate scheduled date
        const scheduledDate = new Date(today);
        scheduledDate.setDate(scheduledDate.getDate() + daySchedule.day - 1);

        tasks.push({
          study_plan_id: studyPlan.id,
          user_id: userId,
          task_type: daySchedule.is_revision ? 'revision' : 'study',
          subject: input.subject,
          chapter: daySchedule.chapter_name,
          chapter_id: daySchedule.chapter_id,
          topic: daySchedule.focus_areas?.join(', ') || '',
          duration_min: Math.round(daySchedule.estimated_hours * 60),
          deadline: scheduledDate.toISOString().split('T')[0],
          scheduled_at: scheduledDate.toISOString(),
          status: 'pending',
        });
      }
    }

    // Add revision tasks
    if (planStructure.revision_schedule) {
      for (const revDay of planStructure.revision_schedule) {
        const scheduledDate = new Date(today);
        scheduledDate.setDate(scheduledDate.getDate() + revDay.day - 1);

        tasks.push({
          study_plan_id: studyPlan.id,
          user_id: userId,
          task_type: 'revision',
          subject: input.subject,
          chapter: 'Revision',
          chapter_id: null,
          topic: revDay.focus,
          duration_min: Math.round(revDay.estimated_hours * 60),
          deadline: scheduledDate.toISOString().split('T')[0],
          scheduled_at: scheduledDate.toISOString(),
          status: 'pending',
        });
      }
    }

    if (tasks.length > 0) {
      const { error: tasksError } = await supabase.from('plan_tasks').insert(tasks);
      if (tasksError) {
        logger.error({ error: tasksError }, 'Failed to save plan tasks');
      }
    }

    // Award XP for creating a plan
    await gamificationService.awardXP(userId, 25, 'plan_created', studyPlan.id, 'Created chapter study plan');

    logger.info({ planId: studyPlan.id, taskCount: tasks.length }, 'Chapter plan and tasks saved');

    res.json(
      successResponse({
        plan: {
          id: studyPlan.id,
          subject: input.subject,
          deadline: input.deadline,
          total_chapters: chapters.length,
          total_days: planStructure.total_days,
          created_at: studyPlan.created_at,
        },
        structure: planStructure,
        warnings: totalHoursNeeded > totalHoursAvailable
          ? [`Time may be tight: ${totalHoursNeeded} hours needed, ${totalHoursAvailable} hours available`]
          : [],
      })
    );
  } catch (error) {
    logger.error({ error, userId, input }, 'Chapter plan generation failed');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to generate chapter plan');
  }
};

/**
 * Get chapter plan details
 * GET /api/planner/chapter-plan/:plan_id
 */
export const getChapterPlan = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { plan_id } = req.params;

  try {
    // Get plan
    const { data: plan, error: planError } = await supabase
      .from('study_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('user_id', userId)
      .single();

    if (planError || !plan) {
      throw new NotFoundError('Plan not found');
    }

    // Get tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('plan_tasks')
      .select('*')
      .eq('study_plan_id', plan_id)
      .order('scheduled_at', { ascending: true });

    if (tasksError) {
      throw new DatabaseError('Failed to fetch tasks');
    }

    // Calculate progress
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter((t) => t.status === 'completed').length || 0;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Check if overdue
    const deadline = new Date(plan.deadline);
    const isOverdue = deadline < new Date() && completionPercent < 100;

    res.json(
      successResponse({
        plan: {
          id: plan.id,
          subject: plan.subject,
          deadline: plan.deadline,
          target_chapters: plan.target_chapters,
          created_at: plan.created_at,
          plan_meta: plan.plan_meta,
        },
        tasks: tasks || [],
        progress: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          completion_percent: completionPercent,
          is_overdue: isOverdue,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId, plan_id }, 'Failed to get chapter plan');
    if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get chapter plan');
  }
};

/**
 * Update chapter task status
 * PATCH /api/planner/chapter-task/:task_id
 */
export const updateChapterTask = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { task_id } = req.params;
  const input = req.body as UpdateChapterTaskInput;

  logger.info({ userId, taskId: task_id, status: input.status }, 'Updating chapter task');

  try {
    // Get task
    const { data: task, error: taskError } = await supabase
      .from('plan_tasks')
      .select('*, study_plans!inner(user_id, deadline)')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      throw new NotFoundError('Task not found');
    }

    if (task.study_plans.user_id !== userId) {
      throw new ValidationError('Access denied');
    }

    // Build update
    const updateData: any = {
      status: input.status,
    };

    if (input.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (input.actual_hours !== undefined) {
      updateData.duration_min = Math.round(input.actual_hours * 60);
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabase
      .from('plan_tasks')
      .update(updateData)
      .eq('id', task_id)
      .select()
      .single();

    if (updateError) {
      throw new DatabaseError('Failed to update task');
    }

    // If completed, award XP and update chapter progress
    if (input.status === 'completed') {
      await gamificationService.awardXP(userId, XP_AWARDS.PLAN_TASK_COMPLETE, 'plan_task', task_id as string);

      // Update chapter progress if chapter_id exists
      if (task.chapter_id) {
        const chapterInfo = getChapterById(task.chapter_id);
        if (chapterInfo) {
          // Increment progress (simple approach: each task = 25% of chapter)
          const { data: existingProgress } = await supabase
            .from('user_chapter_progress')
            .select('progress_percent')
            .eq('user_id', userId)
            .eq('chapter_id', task.chapter_id)
            .single();

          const currentProgress = existingProgress?.progress_percent || 0;
          const newProgress = Math.min(100, currentProgress + 25);

          await supabase.from('user_chapter_progress').upsert(
            {
              user_id: userId,
              chapter_id: task.chapter_id,
              class: chapterInfo.classNum,
              subject: chapterInfo.subject.name,
              chapter_name: chapterInfo.chapter.name,
              progress_percent: newProgress,
              status: newProgress >= 100 ? 'completed' : 'in_progress',
              last_studied_at: new Date().toISOString(),
              ...(newProgress >= 100 ? { completed_at: new Date().toISOString() } : {}),
            },
            { onConflict: 'user_id,chapter_id' }
          );

          // If chapter completed, award more XP
          if (newProgress >= 100 && currentProgress < 100) {
            await gamificationService.awardXP(userId, XP_AWARDS.CHAPTER_COMPLETE, 'chapter_complete', task.chapter_id);
          }
        }
      }

      // Check for new badges
      await gamificationService.checkAndAwardBadges(userId);
    }

    logger.info({ taskId: task_id, status: input.status }, 'Chapter task updated');

    res.json(
      successResponse({
        task: updatedTask,
      })
    );
  } catch (error) {
    logger.error({ error, userId, task_id }, 'Failed to update chapter task');
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update chapter task');
  }
};

/**
 * Get plans by deadline
 * GET /api/planner/by-deadline
 */
export const getPlansByDeadline = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { start_date, end_date, status } = req.query as unknown as GetPlansByDeadlineInput;

  logger.info({ userId, start_date, end_date, status }, 'Fetching plans by deadline');

  try {
    let query = supabase
      .from('study_plans')
      .select('id, plan_date, subject, deadline, target_chapters, plan_meta, created_at')
      .eq('user_id', userId)
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true });

    if (start_date) {
      query = query.gte('deadline', start_date);
    }

    if (end_date) {
      query = query.lte('deadline', end_date);
    }

    const { data: plans, error } = await query;

    if (error) {
      throw new DatabaseError('Failed to fetch plans');
    }

    // Fetch task counts for each plan
    const plansWithProgress = await Promise.all(
      (plans || []).map(async (plan) => {
        const { data: tasks } = await supabase
          .from('plan_tasks')
          .select('status')
          .eq('study_plan_id', plan.id);

        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter((t) => t.status === 'completed').length || 0;
        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const isOverdue = new Date(plan.deadline) < new Date() && completionPercent < 100;
        const isCompleted = completionPercent === 100;

        return {
          ...plan,
          progress: {
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            completion_percent: completionPercent,
          },
          status: isCompleted ? 'completed' : isOverdue ? 'overdue' : 'active',
        };
      })
    );

    // Filter by status
    let filteredPlans = plansWithProgress;
    if (status && status !== 'all') {
      filteredPlans = plansWithProgress.filter((p) => p.status === status);
    }

    res.json(
      successResponse({
        plans: filteredPlans,
        total: filteredPlans.length,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get plans by deadline');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get plans');
  }
};

/**
 * Get today's tasks across all plans
 * GET /api/planner/today
 */
export const getTodayTasks = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { include_overdue } = req.query as unknown as GetTodayTasksInput;

  logger.info({ userId, include_overdue }, 'Fetching today tasks');

  try {
    const today = new Date().toISOString().split('T')[0]!;

    let query = supabase
      .from('plan_tasks')
      .select('*, study_plans!inner(subject, deadline)')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true });

    if (include_overdue) {
      // Include overdue + today's tasks
      query = query.lte('deadline', today).in('status', ['pending', 'in_progress']);
    } else {
      // Only today's tasks
      query = query.eq('deadline', today);
    }

    const { data: tasks, error } = await query;

    if (error) {
      throw new DatabaseError('Failed to fetch tasks');
    }

    // Group by status
    const pending = (tasks || []).filter((t) => t.status === 'pending');
    const inProgress = (tasks || []).filter((t) => t.status === 'in_progress');
    const completed = (tasks || []).filter((t) => t.status === 'completed');
    const overdue = (tasks || []).filter(
      (t) => t.deadline < today && ['pending', 'in_progress'].includes(t.status)
    );

    // Calculate total time
    const totalMinutes = (tasks || []).reduce((sum, t) => sum + (t.duration_min || 0), 0);
    const completedMinutes = completed.reduce((sum, t) => sum + (t.duration_min || 0), 0);

    res.json(
      successResponse({
        date: today,
        tasks: tasks || [],
        summary: {
          total: tasks?.length || 0,
          pending: pending.length,
          in_progress: inProgress.length,
          completed: completed.length,
          overdue: overdue.length,
          total_minutes: totalMinutes,
          completed_minutes: completedMinutes,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get today tasks');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get today tasks');
  }
};

// =============================================================================
// TOPIC-WISE PLANNING & NEW ENDPOINTS
// =============================================================================

/**
 * Generate a topic-wise study plan for a single chapter
 * POST /api/planner/generate-topic-plan
 */
export const generateTopicPlan = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const input = req.body as GenerateTopicPlanInput;

  try {
    const result = await plannerService.generateTopicPlan(userId, input);
    res.json(successResponse(result));
  } catch (error) {
    logger.error({ error, userId, input }, 'Topic plan generation failed');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to generate topic plan');
  }
};

/**
 * Get study streak data
 * GET /api/planner/streak
 */
export const getStreak = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const streakData = await plannerService.calculateStreak(userId);
    res.json(successResponse({ streak: streakData }));
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get streak');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get streak data');
  }
};

/**
 * Get all plans grouped by subject
 * GET /api/planner/all
 */
export const getAllPlans = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { status } = req.query as unknown as GetAllPlansInput;

  try {
    const grouped = await plannerService.getAllPlansGroupedBySubject(userId);

    // Filter by status if requested
    if (status && status !== 'all') {
      for (const subject of Object.keys(grouped)) {
        grouped[subject] = grouped[subject]!.filter((p) => p.status === status);
        if (grouped[subject]!.length === 0) {
          delete grouped[subject];
        }
      }
    }

    // Calculate summary
    let totalPlans = 0;
    let activePlans = 0;
    let completedPlans = 0;
    let overduePlans = 0;

    for (const plans of Object.values(grouped)) {
      totalPlans += plans.length;
      activePlans += plans.filter((p) => p.status === 'active').length;
      completedPlans += plans.filter((p) => p.status === 'completed').length;
      overduePlans += plans.filter((p) => p.status === 'overdue').length;
    }

    res.json(
      successResponse({
        plans_by_subject: grouped,
        subjects: Object.keys(grouped),
        summary: {
          total_plans: totalPlans,
          active_plans: activePlans,
          completed_plans: completedPlans,
          overdue_plans: overduePlans,
        },
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get all plans');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get plans');
  }
};

/**
 * Update chapter task status with chapter completion check
 * PATCH /api/planner/topic-task/:task_id
 * 
 * Enhanced version that checks if all tasks for a chapter are complete
 * and returns a flag for the frontend to show quiz suggestion
 */
export const updateTopicTask = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { task_id } = req.params;
  const input = req.body as UpdateChapterTaskInput;

  logger.info({ userId, taskId: task_id, status: input.status }, 'Updating topic task');

  try {
    // Get task with plan info
    const { data: task, error: taskError } = await supabase
      .from('plan_tasks')
      .select('*, study_plans!inner(id, user_id, deadline, subject, target_chapters)')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      throw new NotFoundError('Task not found');
    }

    if (task.study_plans.user_id !== userId) {
      throw new ValidationError('Access denied');
    }

    // Build update
    const updateData: Record<string, unknown> = {
      status: input.status,
    };

    if (input.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (input.actual_hours !== undefined) {
      updateData.duration_min = Math.round(input.actual_hours * 60);
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabase
      .from('plan_tasks')
      .update(updateData)
      .eq('id', task_id)
      .select()
      .single();

    if (updateError) {
      throw new DatabaseError('Failed to update task');
    }

    let chapterCompleted = false;
    let suggestQuiz = false;

    // If completed, award XP and check chapter completion
    if (input.status === 'completed') {
      await gamificationService.awardXP(userId, XP_AWARDS.PLAN_TASK_COMPLETE, 'plan_task', task_id as string);

      // Check if all tasks for this chapter are now complete
      if (task.chapter_id) {
        const completion = await plannerService.checkChapterCompletion(
          userId,
          task.study_plans.id,
          task.chapter_id
        );

        if (completion.isComplete) {
          chapterCompleted = true;
          suggestQuiz = true;

          // Mark chapter as complete in progress
          await plannerService.markChapterComplete(userId, task.chapter_id);

          logger.info({ userId, chapterId: task.chapter_id }, 'Chapter completed via topic tasks');
        }
      }

      // Check for new badges
      await gamificationService.checkAndAwardBadges(userId);
    }

    logger.info({ taskId: task_id, status: input.status, chapterCompleted }, 'Topic task updated');

    res.json(
      successResponse({
        task: updatedTask,
        chapter_completed: chapterCompleted,
        suggest_quiz: suggestQuiz,
        chapter_id: chapterCompleted ? task.chapter_id : null,
        chapter_name: chapterCompleted ? task.chapter : null,
        subject: task.study_plans.subject,
      })
    );
  } catch (error) {
    logger.error({ error, userId, task_id }, 'Failed to update topic task');
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update topic task');
  }
};
