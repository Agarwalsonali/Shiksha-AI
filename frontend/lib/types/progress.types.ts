/**
 * Progress & Curriculum Types
 * Types for tracking chapter progress and curriculum data
 */

// Chapter progress status
export type ChapterStatus = 'not_started' | 'in_progress' | 'completed';

// System tags for chapters
export type SystemTag =
  | 'need_revision'
  | 'important'
  | 'difficult'
  | 'easy'
  | 'exam_important'
  | 'completed';

// Chapter progress record from database
export interface ChapterProgress {
  id: string;
  user_id: string;
  class: number;
  subject: string;
  chapter_id: string;
  chapter_name: string;
  progress_percent: number;
  status: ChapterStatus;
  system_tags: SystemTag[];
  custom_tags: string[];
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_studied_at: string | null;
  created_at: string;
  updated_at: string;
}

// Chapter with merged progress data (for curriculum display)
export interface ChapterWithProgress {
  id: string;
  order: number;
  name: string;
  description: string;
  topics: string[];
  estimated_hours: number;
  weightage: string;
  // Progress fields
  progress_percent: number;
  status: ChapterStatus;
  system_tags: SystemTag[];
  custom_tags: string[];
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_studied_at: string | null;
}

// Subject with progress data
export interface SubjectWithProgress {
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

// Overall stats for curriculum with progress
export interface CurriculumOverallStats {
  total_subjects: number;
  total_chapters: number;
  completed_chapters: number;
  in_progress_chapters: number;
  not_started_chapters: number;
  overall_progress_percent: number;
}

// Full curriculum with progress response
export interface CurriculumWithProgress {
  class: number;
  board: string;
  overall_stats: CurriculumOverallStats;
  subjects: SubjectWithProgress[];
}

// Progress summary response
export interface ProgressSummary {
  class: number;
  summary: {
    total_tracked: number;
    completed: number;
    in_progress: number;
    not_started: number;
    average_progress: number;
    tags: {
      need_revision: number;
      important: number;
      difficult: number;
    };
  };
  by_subject: Record<
    string,
    {
      completed: number;
      in_progress: number;
      not_started: number;
      total: number;
    }
  >;
}

// Update chapter progress input
export interface UpdateChapterProgressInput {
  progress_percent?: number;
  status?: ChapterStatus;
  notes?: string;
  system_tags?: SystemTag[];
  custom_tags?: string[];
}

// Add tag input
export interface AddTagInput {
  tag: string;
  type: 'system' | 'custom';
}

// Bulk update input
export interface BulkUpdateItem {
  chapter_id: string;
  progress_percent?: number;
  status?: ChapterStatus;
}

// Bulk update response
export interface BulkUpdateResponse {
  updated: number;
  failed: number;
  results: ChapterProgress[];
  errors?: Array<{ chapter_id: string; error: string }>;
}
