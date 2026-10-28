// =============================================================================
// TASK TYPES
// =============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type TaskType = 'study' | 'quiz' | 'revision' | 'read' | 'practice' | 'solve' | 'understand' | 'memorize';
export type Priority = 'high' | 'medium' | 'low';

export interface PlanTask {
  id: string;
  study_plan_id: string;
  task_type: TaskType;
  subject: string;
  chapter: string | null;
  chapter_id: string | null;
  topic: string | null;
  duration_min: number;
  deadline: string | null;
  scheduled_at: string | null;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
}

// =============================================================================
// PLAN TYPES
// =============================================================================

export interface PlanMeta {
  type?: 'chapter_plan' | 'topic_plan' | 'exam_plan';
  title?: string;
  subject?: string;
  chapter_id?: string;
  chapter_name?: string;
  total_days?: number;
  total_chapters?: number;
  total_topics?: number;
  daily_hours?: number;
  exam_date?: string;
  include_quiz?: boolean;
  schedule?: unknown[];
  topics?: TopicSchedule[];
  revision_schedule?: unknown[];
}

export interface StudyPlan {
  id: string;
  plan_date: string;
  subject: string | null;
  deadline: string | null;
  target_chapters: string[] | null;
  plan_meta: PlanMeta;
  generated_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlanProgress {
  total_tasks: number;
  completed_tasks: number;
  completion_percent: number;
  is_overdue?: boolean;
}

export type PlanStatus = 'active' | 'completed' | 'overdue';

export interface PlanWithProgress extends StudyPlan {
  progress: PlanProgress;
  status: PlanStatus;
}

// =============================================================================
// TOPIC PLAN TYPES
// =============================================================================

export interface TopicTask {
  title: string;
  description: string;
  duration_minutes: number;
  type: TaskType;
}

export interface TopicSchedule {
  day: number;
  date: string;
  topic_name: string;
  topic_order: number;
  priority: Priority;
  estimated_minutes: number;
  learning_objectives: string[];
  tasks: TopicTask[];
}

export interface TopicStudyPlan {
  title: string;
  subject: string;
  chapter_id: string;
  chapter_name: string;
  deadline: string;
  total_days: number;
  total_topics: number;
  daily_hours: number;
  topics: TopicSchedule[];
  quiz_day?: number;
}

// =============================================================================
// STREAK TYPES
// =============================================================================

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  study_dates: string[];
  last_study_date: string | null;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

export interface GenerateTopicPlanRequest {
  subject: string;
  chapter_id: string;
  deadline: string;
  daily_study_hours: number;
  priority_topics?: string[];
  include_quiz?: boolean;
}

export interface GenerateChapterPlanRequest {
  subject: string;
  chapter_ids: string[];
  deadline: string;
  daily_study_hours: number;
  priority_chapters?: string[];
  include_revision?: boolean;
  revision_days?: number;
}

export interface UpdateTaskRequest {
  status: TaskStatus;
  actual_hours?: number;
  notes?: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface GenerateTopicPlanResponse {
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
}

export interface StreakResponse {
  streak: StreakData;
}

export interface AllPlansResponse {
  plans_by_subject: Record<string, PlanWithProgress[]>;
  subjects: string[];
  summary: {
    total_plans: number;
    active_plans: number;
    completed_plans: number;
    overdue_plans: number;
  };
}

export interface UpdateTaskResponse {
  task: PlanTask;
  chapter_completed: boolean;
  suggest_quiz: boolean;
  chapter_id: string | null;
  chapter_name: string | null;
  subject: string;
}

export interface TodayTasksResponse {
  date: string;
  tasks: PlanTask[];
  summary: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
    total_minutes: number;
    completed_minutes: number;
  };
}

export interface PlanDetailsResponse {
  plan: StudyPlan;
  tasks: PlanTask[];
  progress: PlanProgress;
}

// =============================================================================
// UI HELPER TYPES
// =============================================================================

export interface TaskWithPlanInfo extends PlanTask {
  plan_subject?: string;
  plan_deadline?: string;
}

export interface SubjectTabData {
  subject: string;
  plans: PlanWithProgress[];
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
}
