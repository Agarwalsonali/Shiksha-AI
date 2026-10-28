import { apiClient } from './client';
import type {
  GenerateTopicPlanRequest,
  GenerateTopicPlanResponse,
  GenerateChapterPlanRequest,
  StreakResponse,
  AllPlansResponse,
  UpdateTaskRequest,
  UpdateTaskResponse,
  TodayTasksResponse,
  PlanDetailsResponse,
  PlanWithProgress,
  PlanStatus,
} from '../types/planner.types';

// =============================================================================
// PLAN GENERATION
// =============================================================================

/**
 * Generate a topic-wise study plan for a single chapter
 */
export const generateTopicPlan = async (
  data: GenerateTopicPlanRequest
): Promise<GenerateTopicPlanResponse> => {
  return apiClient.post<GenerateTopicPlanResponse>('/api/planner/generate-topic-plan', data);
};

/**
 * Generate a chapter-wise study plan
 */
export const generateChapterPlan = async (
  data: GenerateChapterPlanRequest
): Promise<{ plan: { id: string }; structure: unknown; warnings: string[] }> => {
  return apiClient.post('/api/planner/generate-chapter-plan', data);
};

// =============================================================================
// PLAN RETRIEVAL
// =============================================================================

/**
 * Get all plans grouped by subject
 */
export const getAllPlans = async (
  status: PlanStatus | 'all' = 'all'
): Promise<AllPlansResponse> => {
  return apiClient.get<AllPlansResponse>(`/api/planner/all?status=${status}`);
};

/**
 * Get plans filtered by deadline
 */
export const getPlansByDeadline = async (params: {
  start_date?: string;
  end_date?: string;
  status?: PlanStatus | 'all';
}): Promise<{ plans: PlanWithProgress[]; total: number }> => {
  const searchParams = new URLSearchParams();
  if (params.start_date) searchParams.set('start_date', params.start_date);
  if (params.end_date) searchParams.set('end_date', params.end_date);
  if (params.status) searchParams.set('status', params.status);
  
  return apiClient.get(`/api/planner/by-deadline?${searchParams.toString()}`);
};

/**
 * Get chapter plan details
 */
export const getChapterPlan = async (planId: string): Promise<PlanDetailsResponse> => {
  return apiClient.get<PlanDetailsResponse>(`/api/planner/chapter-plan/${planId}`);
};

/**
 * Get plan for a specific date
 */
export const getPlanByDate = async (date?: string): Promise<PlanDetailsResponse> => {
  const endpoint = date ? `/api/planner/plan?date=${date}` : '/api/planner/plan';
  return apiClient.get<PlanDetailsResponse>(endpoint);
};

// =============================================================================
// TASK MANAGEMENT
// =============================================================================

/**
 * Update topic task status (with chapter completion check)
 */
export const updateTopicTask = async (
  taskId: string,
  data: UpdateTaskRequest
): Promise<UpdateTaskResponse> => {
  return apiClient.patch<UpdateTaskResponse>(`/api/planner/topic-task/${taskId}`, data);
};

/**
 * Update chapter task status
 */
export const updateChapterTask = async (
  taskId: string,
  data: UpdateTaskRequest
): Promise<UpdateTaskResponse> => {
  return apiClient.patch<UpdateTaskResponse>(`/api/planner/chapter-task/${taskId}`, data);
};

/**
 * Update regular task status
 */
export const updateTask = async (
  taskId: string,
  data: { status: string; completed_at?: string }
): Promise<{ task: unknown }> => {
  return apiClient.patch(`/api/planner/task/${taskId}`, data);
};

/**
 * Get today's tasks across all plans
 */
export const getTodayTasks = async (
  includeOverdue: boolean = true
): Promise<TodayTasksResponse> => {
  return apiClient.get<TodayTasksResponse>(
    `/api/planner/today?include_overdue=${includeOverdue}`
  );
};

// =============================================================================
// STREAK & PROGRESS
// =============================================================================

/**
 * Get study streak data
 */
export const getStreak = async (): Promise<StreakResponse> => {
  return apiClient.get<StreakResponse>('/api/planner/streak');
};

/**
 * Get progress for a specific plan
 */
export const getProgress = async (params: {
  plan_id?: string;
  date?: string;
}): Promise<{
  progress: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    skipped_tasks: number;
    in_progress_tasks: number;
    completion_percentage: number;
    total_minutes: number;
    completed_minutes: number;
  };
}> => {
  const searchParams = new URLSearchParams();
  if (params.plan_id) searchParams.set('plan_id', params.plan_id);
  if (params.date) searchParams.set('date', params.date);
  
  return apiClient.get(`/api/planner/progress?${searchParams.toString()}`);
};

// =============================================================================
// PLAN MANAGEMENT
// =============================================================================

/**
 * Delete a study plan
 */
export const deletePlan = async (planId: string): Promise<{ message: string }> => {
  return apiClient.delete(`/api/planner/plan/${planId}`);
};

/**
 * List all plans with pagination
 */
export const listPlans = async (params: {
  page?: number;
  limit?: number;
  subject?: string;
}): Promise<{
  plans: Array<{
    id: string;
    plan_date: string;
    subject: string;
    title: string;
    total_days: number;
    generated_by: string;
    created_at: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.subject) searchParams.set('subject', params.subject);
  
  return apiClient.get(`/api/planner/plans?${searchParams.toString()}`);
};

// =============================================================================
// EXPORT API
// =============================================================================

export const plannerApi = {
  // Generation
  generateTopicPlan,
  generateChapterPlan,
  
  // Retrieval
  getAllPlans,
  getPlansByDeadline,
  getChapterPlan,
  getPlanByDate,
  
  // Tasks
  updateTopicTask,
  updateChapterTask,
  updateTask,
  getTodayTasks,
  
  // Streak & Progress
  getStreak,
  getProgress,
  
  // Management
  deletePlan,
  listPlans,
};
