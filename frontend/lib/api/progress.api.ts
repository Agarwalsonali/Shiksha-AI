/**
 * Progress API Service
 * Handles chapter progress tracking and curriculum data
 */

import { apiClient } from './client';
import type {
  ChapterProgress,
  CurriculumWithProgress,
  ProgressSummary,
  UpdateChapterProgressInput,
  AddTagInput,
  BulkUpdateItem,
  BulkUpdateResponse,
} from '../types/progress.types';

export const progressApi = {
  /**
   * Get full curriculum with user progress (for Accordion UI)
   * Perfect for displaying subjects and chapters with completion status
   */
  getCurriculumWithProgress: (subject?: string) => {
    const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return apiClient.get<CurriculumWithProgress>(`/api/progress/curriculum${params}`);
  },

  /**
   * Get all chapter progress records
   */
  getAllProgress: (filters?: { subject?: string; status?: string; has_tag?: string }) => {
    const params = new URLSearchParams();
    if (filters?.subject) params.set('subject', filters.subject);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.has_tag) params.set('has_tag', filters.has_tag);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<ChapterProgress[]>(`/api/progress${query}`);
  },

  /**
   * Get progress summary with stats
   */
  getSummary: (subject?: string) => {
    const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return apiClient.get<ProgressSummary>(`/api/progress/summary${params}`);
  },

  /**
   * Get progress for a specific chapter
   */
  getChapterProgress: (chapterId: string) => {
    return apiClient.get<ChapterProgress>(`/api/progress/chapter/${chapterId}`);
  },

  /**
   * Update chapter progress
   */
  updateChapterProgress: (chapterId: string, updates: UpdateChapterProgressInput) => {
    return apiClient.put<{ progress: ChapterProgress; message: string }>(
      `/api/progress/chapter/${chapterId}`,
      updates
    );
  },

  /**
   * Add a tag to a chapter
   */
  addTag: (chapterId: string, input: AddTagInput) => {
    return apiClient.post<{ progress: ChapterProgress; message: string }>(
      `/api/progress/chapter/${chapterId}/tag`,
      input
    );
  },

  /**
   * Remove a tag from a chapter
   */
  removeTag: (chapterId: string, tag: string) => {
    return apiClient.delete<{ progress: ChapterProgress; message: string }>(
      `/api/progress/chapter/${chapterId}/tag/${encodeURIComponent(tag)}`
    );
  },

  /**
   * Bulk update multiple chapters
   */
  bulkUpdate: (updates: BulkUpdateItem[]) => {
    return apiClient.post<BulkUpdateResponse>('/api/progress/bulk', { updates });
  },

  /**
   * Get chapters by tag
   */
  getByTag: (tag: string) => {
    return apiClient.get<{ tag: string; count: number; chapters: ChapterProgress[] }>(
      `/api/progress/by-tag/${encodeURIComponent(tag)}`
    );
  },
};
