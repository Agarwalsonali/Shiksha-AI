/**
 * Common TypeScript types and interfaces
 */

// Re-export AuthRequest from auth middleware
export type { AuthRequest } from '../middleware/auth.ts';

// Database enums (matching SQL schema)
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type MessageRole = 'user' | 'assistant';
export type ActivityType = 'chat' | 'quiz_attempt' | 'plan_completed' | 'task_completed' | 'login';
export type AnswerMode = 'simple' | '2-mark' | '5-mark' | 'topper';
export type TaskType = 'study' | 'quiz' | 'revision' | 'watch_video';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

// User Profile
export interface UserProfile {
  user_id: string;
  class: number;
  board: string;
  subjects: string[];
  weak_topics: string[];
  strong_topics: string[];
  target_exams: string[];
  daily_study_hours: number;
  timezone: string;
  updated_at: string;
}

// Tutor Types
export interface TutorSession {
  id: string;
  user_id: string;
  started_at: string;
  last_active_at: string;
}

export interface TutorMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  detected_class?: number;
  detected_subject?: string;
  detected_chapter?: string;
  detected_topic?: string;
  detection_confidence?: number;
  answer_mode?: string;
  created_at: string;
}

// Quiz Types
export interface Quiz {
  id: string;
  user_id: string;
  created_by: string;
  subject: string;
  topic: string;
  chapter?: string;
  difficulty: DifficultyLevel;
  total_questions: number;
  config: any;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  correct_answers: number;
  total_questions: number;
  time_taken_seconds: number;
  score_percent: number;
  attempt_meta: any;
  created_at: string;
}

// Planner Types
export interface StudyPlan {
  id: string;
  user_id: string;
  plan_date: string;
  generated_by: string;
  plan_meta: any;
  created_at: string;
  updated_at: string;
}

export interface PlanTask {
  id: string;
  study_plan_id: string;
  user_id: string;
  task_type: TaskType;
  subject?: string;
  chapter?: string;
  topic?: string;
  duration_min: number;
  quiz_id?: string;
  scheduled_at?: string;
  status: TaskStatus;
  completed_at?: string;
  created_at: string;
}

// Stats Types
export interface TopicWeakness {
  id: string;
  user_id: string;
  topic_master_id?: string;
  subject: string;
  chapter: string;
  topic: string;
  weakness_score: number;
  evidence_count: number;
  last_computed_at: string;
  note?: string;
}

export interface UserStreak {
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string;
  updated_at: string;
}

// NCERT/Topic Master Types
export interface TopicMaster {
  id: string;
  curriculum_class: number;
  board: string;
  subject: string;
  chapter: string;
  chapter_order: number;
  topic: string;
  topic_order: number;
  source_file?: string;
  source_page_range?: string;
  created_at: string;
}

export interface NCERTChunk {
  id: string;
  topic_master_id?: string;
  chunk_text: string;
  token_count?: number;
  chunk_order: number;
  source?: string;
  external_vector_id?: string;
  created_at: string;
}
