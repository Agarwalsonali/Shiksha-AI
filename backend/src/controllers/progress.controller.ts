import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse } from '../utils/apiResponse';
import { NotFoundError, DatabaseError, ValidationError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { getChapterById, getSubjectByName, isValidClass } from '../data/curriculum';
import type {
  GetProgressInput,
  GetChapterProgressInput,
  UpdateChapterProgressInput,
  AddTagInput,
  RemoveTagInput,
  GetProgressSummaryInput,
  BulkUpdateProgressInput,
  GetByTagInput,
  GetCurriculumWithProgressInput,
} from '../schemas/progress.schema';
import { getCurriculumByClass, type Chapter, type Subject } from '../data/curriculum';

/**
 * Get all chapter progress for user
 * GET /api/progress
 */
export const getProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { subject, status, has_tag } = req.query as unknown as GetProgressInput;

  logger.info({ userId, subject, status, has_tag }, 'Fetching chapter progress');

  try {
    // Get user profile to know their class
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found. Please complete your profile first.');
    }

    let query = supabase
      .from('user_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('class', profile.class)
      .order('subject', { ascending: true })
      .order('chapter_id', { ascending: true });

    if (subject) {
      query = query.eq('subject', subject);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: progress, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch progress');
      throw new DatabaseError('Failed to fetch progress');
    }

    // Filter by tag if specified
    let filteredProgress = progress || [];
    if (has_tag) {
      filteredProgress = filteredProgress.filter(
        (p) =>
          p.system_tags?.includes(has_tag) || p.custom_tags?.includes(has_tag)
      );
    }

    res.json(
      successResponse({
        class: profile.class,
        total_tracked: filteredProgress.length,
        progress: filteredProgress,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get progress');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get progress');
  }
};

/**
 * Get progress for a specific chapter
 * GET /api/progress/chapter/:chapter_id
 */
export const getChapterProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { chapter_id } = req.params as GetChapterProgressInput;

  logger.info({ userId, chapter_id }, 'Fetching chapter progress');

  try {
    // Verify chapter exists in curriculum
    const chapterInfo = getChapterById(chapter_id);
    if (!chapterInfo) {
      throw new NotFoundError(`Chapter '${chapter_id}' not found in curriculum`);
    }

    // Get progress from database
    const { data: progress, error } = await supabase
      .from('user_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('chapter_id', chapter_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      logger.error({ error }, 'Failed to fetch chapter progress');
      throw new DatabaseError('Failed to fetch chapter progress');
    }

    // Return default values if no progress exists
    const progressData = progress || {
      chapter_id,
      progress_percent: 0,
      status: 'not_started',
      system_tags: [],
      custom_tags: [],
      notes: null,
      started_at: null,
      completed_at: null,
      last_studied_at: null,
    };

    res.json(
      successResponse({
        chapter: {
          id: chapterInfo.chapter.id,
          name: chapterInfo.chapter.name,
          description: chapterInfo.chapter.description,
          subject: chapterInfo.subject.name,
          class: chapterInfo.classNum,
        },
        progress: progressData,
      })
    );
  } catch (error) {
    logger.error({ error, userId, chapter_id }, 'Failed to get chapter progress');
    if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get chapter progress');
  }
};

/**
 * Update chapter progress
 * PUT /api/progress/chapter/:chapter_id
 */
export const updateChapterProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { chapter_id } = req.params as { chapter_id: string };
  const updates = req.body as UpdateChapterProgressInput;

  logger.info({ userId, chapter_id, updates }, 'Updating chapter progress');

  try {
    // Verify chapter exists in curriculum
    const chapterInfo = getChapterById(chapter_id);
    if (!chapterInfo) {
      throw new NotFoundError(`Chapter '${chapter_id}' not found in curriculum`);
    }

    // Get user profile for class
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found');
    }

    // Verify class matches
    if (profile.class !== chapterInfo.classNum) {
      throw new ValidationError(`Chapter belongs to class ${chapterInfo.classNum}, but you are in class ${profile.class}`);
    }

    // Build update object
    const now = new Date().toISOString();
    const updateData: any = {
      ...updates,
      last_studied_at: now,
      updated_at: now,
    };

    // Set timestamps based on status
    if (updates.status === 'in_progress' || (updates.progress_percent && updates.progress_percent > 0)) {
      updateData.started_at = now; // Will be ignored if already set (handled by upsert)
    }
    if (updates.status === 'completed' || updates.progress_percent === 100) {
      updateData.completed_at = now;
      updateData.status = 'completed';
      updateData.progress_percent = 100;
    }

    // Auto-set status based on progress
    if (updates.progress_percent !== undefined && !updates.status) {
      if (updates.progress_percent === 0) {
        updateData.status = 'not_started';
      } else if (updates.progress_percent === 100) {
        updateData.status = 'completed';
      } else {
        updateData.status = 'in_progress';
      }
    }

    // Upsert progress
    const { data: progress, error } = await supabase
      .from('user_chapter_progress')
      .upsert(
        {
          user_id: userId,
          chapter_id,
          class: chapterInfo.classNum,
          subject: chapterInfo.subject.name,
          chapter_name: chapterInfo.chapter.name,
          ...updateData,
        },
        { onConflict: 'user_id,chapter_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to update chapter progress');
      throw new DatabaseError('Failed to update chapter progress');
    }

    logger.info({ userId, chapter_id, status: progress.status }, 'Chapter progress updated');

    res.json(
      successResponse({
        progress,
        message: 'Progress updated successfully',
      })
    );
  } catch (error) {
    logger.error({ error, userId, chapter_id }, 'Failed to update chapter progress');
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to update chapter progress');
  }
};

/**
 * Add a tag to a chapter
 * POST /api/progress/chapter/:chapter_id/tag
 */
export const addTag = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { chapter_id } = req.params as { chapter_id: string };
  const { tag, type } = req.body as AddTagInput;

  logger.info({ userId, chapter_id, tag, type }, 'Adding tag to chapter');

  try {
    // Verify chapter exists
    const chapterInfo = getChapterById(chapter_id);
    if (!chapterInfo) {
      throw new NotFoundError(`Chapter '${chapter_id}' not found`);
    }

    // Get current progress
    const { data: current, error: fetchError } = await supabase
      .from('user_chapter_progress')
      .select('system_tags, custom_tags')
      .eq('user_id', userId)
      .eq('chapter_id', chapter_id)
      .single();

    const existingSystemTags = current?.system_tags || [];
    const existingCustomTags = current?.custom_tags || [];

    let updateField: string;
    let newTags: string[];

    if (type === 'system') {
      const validSystemTags = ['need_revision', 'important', 'difficult', 'easy', 'exam_important', 'completed'];
      if (!validSystemTags.includes(tag)) {
        throw new ValidationError(`Invalid system tag. Valid tags: ${validSystemTags.join(', ')}`);
      }
      if (existingSystemTags.includes(tag)) {
        throw new ValidationError('Tag already exists');
      }
      updateField = 'system_tags';
      newTags = [...existingSystemTags, tag];
    } else {
      if (existingCustomTags.includes(tag)) {
        throw new ValidationError('Tag already exists');
      }
      if (existingCustomTags.length >= 10) {
        throw new ValidationError('Maximum 10 custom tags allowed');
      }
      updateField = 'custom_tags';
      newTags = [...existingCustomTags, tag];
    }

    // Upsert with new tags
    const { data: progress, error } = await supabase
      .from('user_chapter_progress')
      .upsert(
        {
          user_id: userId,
          chapter_id,
          class: chapterInfo.classNum,
          subject: chapterInfo.subject.name,
          chapter_name: chapterInfo.chapter.name,
          [updateField]: newTags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,chapter_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to add tag');
      throw new DatabaseError('Failed to add tag');
    }

    res.json(
      successResponse({
        progress,
        message: `Tag '${tag}' added successfully`,
      })
    );
  } catch (error) {
    logger.error({ error, userId, chapter_id, tag }, 'Failed to add tag');
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to add tag');
  }
};

/**
 * Remove a tag from a chapter
 * DELETE /api/progress/chapter/:chapter_id/tag/:tag
 */
export const removeTag = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { chapter_id, tag } = req.params as RemoveTagInput;

  logger.info({ userId, chapter_id, tag }, 'Removing tag from chapter');

  try {
    // Get current progress
    const { data: current, error: fetchError } = await supabase
      .from('user_chapter_progress')
      .select('system_tags, custom_tags')
      .eq('user_id', userId)
      .eq('chapter_id', chapter_id)
      .single();

    if (fetchError || !current) {
      throw new NotFoundError('Progress not found for this chapter');
    }

    const systemTags = current.system_tags || [];
    const customTags = current.custom_tags || [];

    // Determine which array to update
    let updateData: any = { updated_at: new Date().toISOString() };

    if (systemTags.includes(tag)) {
      updateData.system_tags = systemTags.filter((t: string) => t !== tag);
    } else if (customTags.includes(tag)) {
      updateData.custom_tags = customTags.filter((t: string) => t !== tag);
    } else {
      throw new NotFoundError(`Tag '${tag}' not found`);
    }

    // Update
    const { data: progress, error } = await supabase
      .from('user_chapter_progress')
      .update(updateData)
      .eq('user_id', userId)
      .eq('chapter_id', chapter_id)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to remove tag');
      throw new DatabaseError('Failed to remove tag');
    }

    res.json(
      successResponse({
        progress,
        message: `Tag '${tag}' removed successfully`,
      })
    );
  } catch (error) {
    logger.error({ error, userId, chapter_id, tag }, 'Failed to remove tag');
    if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to remove tag');
  }
};

/**
 * Get progress summary
 * GET /api/progress/summary
 */
export const getProgressSummary = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { subject } = req.query as unknown as GetProgressSummaryInput;

  logger.info({ userId, subject }, 'Fetching progress summary');

  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found');
    }

    let query = supabase
      .from('user_chapter_progress')
      .select('status, progress_percent, subject, system_tags')
      .eq('user_id', userId)
      .eq('class', profile.class);

    if (subject) {
      query = query.eq('subject', subject);
    }

    const { data: progress, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch progress summary');
      throw new DatabaseError('Failed to fetch progress summary');
    }

    const progressList = progress || [];

    // Calculate summary
    const totalTracked = progressList.length;
    const completed = progressList.filter((p) => p.status === 'completed').length;
    const inProgress = progressList.filter((p) => p.status === 'in_progress').length;
    const notStarted = progressList.filter((p) => p.status === 'not_started').length;
    const avgProgress = totalTracked > 0
      ? Math.round(progressList.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / totalTracked)
      : 0;

    // Count tags
    const needRevision = progressList.filter((p) => p.system_tags?.includes('need_revision')).length;
    const important = progressList.filter((p) => p.system_tags?.includes('important')).length;
    const difficult = progressList.filter((p) => p.system_tags?.includes('difficult')).length;

    // Group by subject
    const bySubject: Record<string, { completed: number; in_progress: number; not_started: number; total: number }> = {};
    for (const p of progressList) {
      const subjectName = p.subject || 'Unknown';
      if (!bySubject[subjectName]) {
        bySubject[subjectName] = { completed: 0, in_progress: 0, not_started: 0, total: 0 };
      }
      bySubject[subjectName].total++;
      if (p.status === 'completed') bySubject[subjectName].completed++;
      else if (p.status === 'in_progress') bySubject[subjectName].in_progress++;
      else bySubject[subjectName].not_started++;
    }

    res.json(
      successResponse({
        class: profile.class,
        summary: {
          total_tracked: totalTracked,
          completed,
          in_progress: inProgress,
          not_started: notStarted,
          average_progress: avgProgress,
          tags: {
            need_revision: needRevision,
            important,
            difficult,
          },
        },
        by_subject: bySubject,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get progress summary');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get progress summary');
  }
};

/**
 * Bulk update progress
 * POST /api/progress/bulk
 */
export const bulkUpdateProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { updates } = req.body as BulkUpdateProgressInput;

  logger.info({ userId, updateCount: updates.length }, 'Bulk updating progress');

  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found');
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      const chapterInfo = getChapterById(update.chapter_id);
      if (!chapterInfo) {
        errors.push({ chapter_id: update.chapter_id, error: 'Chapter not found' });
        continue;
      }

      if (chapterInfo.classNum !== profile.class) {
        errors.push({ chapter_id: update.chapter_id, error: 'Class mismatch' });
        continue;
      }

      const now = new Date().toISOString();
      const updateData: any = {
        user_id: userId,
        chapter_id: update.chapter_id,
        class: chapterInfo.classNum,
        subject: chapterInfo.subject.name,
        chapter_name: chapterInfo.chapter.name,
        last_studied_at: now,
        updated_at: now,
      };

      if (update.progress_percent !== undefined) {
        updateData.progress_percent = update.progress_percent;
        if (update.progress_percent === 0) {
          updateData.status = 'not_started';
        } else if (update.progress_percent === 100) {
          updateData.status = 'completed';
          updateData.completed_at = now;
        } else {
          updateData.status = 'in_progress';
          updateData.started_at = now;
        }
      }

      if (update.status) {
        updateData.status = update.status;
        if (update.status === 'completed') {
          updateData.completed_at = now;
          updateData.progress_percent = 100;
        } else if (update.status === 'in_progress') {
          updateData.started_at = now;
        }
      }

      const { data, error } = await supabase
        .from('user_chapter_progress')
        .upsert(updateData, { onConflict: 'user_id,chapter_id' })
        .select()
        .single();

      if (error) {
        errors.push({ chapter_id: update.chapter_id, error: error.message });
      } else {
        results.push(data);
      }
    }

    logger.info({ userId, successCount: results.length, errorCount: errors.length }, 'Bulk update completed');

    res.json(
      successResponse({
        updated: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to bulk update progress');
    if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to bulk update progress');
  }
};

/**
 * Get chapters by tag
 * GET /api/progress/by-tag/:tag
 */
export const getByTag = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { tag } = req.params as GetByTagInput;

  logger.info({ userId, tag }, 'Fetching chapters by tag');

  try {
    const { data: progress, error } = await supabase
      .from('user_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .or(`system_tags.cs.{${tag}},custom_tags.cs.{${tag}}`);

    if (error) {
      logger.error({ error }, 'Failed to fetch by tag');
      throw new DatabaseError('Failed to fetch chapters by tag');
    }

    res.json(
      successResponse({
        tag,
        count: progress?.length || 0,
        chapters: progress || [],
      })
    );
  } catch (error) {
    logger.error({ error, userId, tag }, 'Failed to get chapters by tag');
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get chapters by tag');
  }
};

/**
 * Get full curriculum with user progress (for Accordion UI)
 * GET /api/progress/curriculum
 * 
 * Returns the complete curriculum for user's class with progress data merged.
 * Perfect for frontend Accordion display - subject-wise chapters with completion status.
 */
export const getCurriculumWithProgress = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { subject: filterSubject } = req.query as unknown as GetCurriculumWithProgressInput;

  logger.info({ userId, filterSubject }, 'Fetching curriculum with progress');

  try {
    // Get user profile to know their class
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('class, subjects')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('User profile not found. Please complete your profile first.');
    }

    // Get curriculum for user's class
    const curriculum = getCurriculumByClass(profile.class);
    if (!curriculum) {
      throw new NotFoundError(`Curriculum not found for class ${profile.class}`);
    }

    // Get all user progress for this class
    const { data: progressData, error: progressError } = await supabase
      .from('user_chapter_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('class', profile.class);

    if (progressError) {
      logger.error({ error: progressError }, 'Failed to fetch progress data');
    }

    // Create a map of chapter_id -> progress for quick lookup
    const progressMap = new Map<string, any>();
    for (const p of (progressData || [])) {
      progressMap.set(p.chapter_id, p);
    }

    // Build the response with merged data
    interface ChapterWithProgress {
      id: string;
      order: number;
      name: string;
      description: string;
      topics: string[];
      estimated_hours: number;
      weightage: string;
      // Progress fields
      progress_percent: number;
      status: 'not_started' | 'in_progress' | 'completed';
      system_tags: string[];
      custom_tags: string[];
      notes: string | null;
      started_at: string | null;
      completed_at: string | null;
      last_studied_at: string | null;
    }

    interface SubjectWithProgress {
      id: string;
      name: string;
      icon: string;
      color: string;
      total_chapters: number;
      // Computed progress stats
      completed_chapters: number;
      in_progress_chapters: number;
      not_started_chapters: number;
      overall_progress_percent: number;
      total_estimated_hours: number;
      completed_hours: number;
      // Tags summary
      chapters_need_revision: number;
      chapters_important: number;
      chapters_difficult: number;
      // Chapters with progress
      chapters: ChapterWithProgress[];
    }

    const subjectsWithProgress: SubjectWithProgress[] = [];

    for (const subject of curriculum.subjects) {
      // Filter by subject if specified
      if (filterSubject && subject.name.toLowerCase() !== filterSubject.toLowerCase() && subject.id !== filterSubject) {
        continue;
      }

      const chaptersWithProgress: ChapterWithProgress[] = [];
      let completedCount = 0;
      let inProgressCount = 0;
      let totalProgressPercent = 0;
      let completedHours = 0;
      let needRevisionCount = 0;
      let importantCount = 0;
      let difficultCount = 0;

      for (const chapter of subject.chapters) {
        const progress = progressMap.get(chapter.id);

        const chapterProgress: ChapterWithProgress = {
          id: chapter.id,
          order: chapter.order,
          name: chapter.name,
          description: chapter.description,
          topics: chapter.topics,
          estimated_hours: chapter.estimated_hours,
          weightage: chapter.weightage,
          // Progress data (default to not started if no progress record)
          progress_percent: progress?.progress_percent ?? 0,
          status: progress?.status ?? 'not_started',
          system_tags: progress?.system_tags ?? [],
          custom_tags: progress?.custom_tags ?? [],
          notes: progress?.notes ?? null,
          started_at: progress?.started_at ?? null,
          completed_at: progress?.completed_at ?? null,
          last_studied_at: progress?.last_studied_at ?? null,
        };

        chaptersWithProgress.push(chapterProgress);

        // Calculate stats
        if (chapterProgress.status === 'completed') {
          completedCount++;
          completedHours += chapter.estimated_hours;
        } else if (chapterProgress.status === 'in_progress') {
          inProgressCount++;
          completedHours += (chapter.estimated_hours * chapterProgress.progress_percent) / 100;
        }
        totalProgressPercent += chapterProgress.progress_percent;

        // Count tags
        if (chapterProgress.system_tags.includes('need_revision')) needRevisionCount++;
        if (chapterProgress.system_tags.includes('important')) importantCount++;
        if (chapterProgress.system_tags.includes('difficult')) difficultCount++;
      }

      const totalChapters = subject.chapters.length;
      const totalHours = subject.chapters.reduce((sum, ch) => sum + ch.estimated_hours, 0);

      subjectsWithProgress.push({
        id: subject.id,
        name: subject.name,
        icon: subject.icon,
        color: subject.color,
        total_chapters: totalChapters,
        completed_chapters: completedCount,
        in_progress_chapters: inProgressCount,
        not_started_chapters: totalChapters - completedCount - inProgressCount,
        overall_progress_percent: totalChapters > 0 ? Math.round(totalProgressPercent / totalChapters) : 0,
        total_estimated_hours: totalHours,
        completed_hours: Math.round(completedHours * 10) / 10,
        chapters_need_revision: needRevisionCount,
        chapters_important: importantCount,
        chapters_difficult: difficultCount,
        chapters: chaptersWithProgress,
      });
    }

    // Calculate overall stats
    const totalChapters = subjectsWithProgress.reduce((sum, s) => sum + s.total_chapters, 0);
    const totalCompleted = subjectsWithProgress.reduce((sum, s) => sum + s.completed_chapters, 0);
    const totalInProgress = subjectsWithProgress.reduce((sum, s) => sum + s.in_progress_chapters, 0);
    const overallProgressSum = subjectsWithProgress.reduce((sum, s) => sum + s.overall_progress_percent * s.total_chapters, 0);
    const overallProgress = totalChapters > 0 ? Math.round(overallProgressSum / totalChapters) : 0;

    res.json(
      successResponse({
        class: profile.class,
        board: curriculum.board,
        overall_stats: {
          total_subjects: subjectsWithProgress.length,
          total_chapters: totalChapters,
          completed_chapters: totalCompleted,
          in_progress_chapters: totalInProgress,
          not_started_chapters: totalChapters - totalCompleted - totalInProgress,
          overall_progress_percent: overallProgress,
        },
        subjects: subjectsWithProgress,
      })
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get curriculum with progress');
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof DatabaseError) throw error;
    throw new DatabaseError('Failed to get curriculum with progress');
  }
};
