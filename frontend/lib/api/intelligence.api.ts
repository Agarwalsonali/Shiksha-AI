/**
 * Intelligence API Service
 * Handles IQ tracking, knowledge levels, and cognitive assessment
 */

import { apiClient } from './client';
import type {
  IQLevel,
  KnowledgeLevel,
  EvaluationRecord,
  IntelligenceSummary,
} from '../types/intelligence.types';

export const intelligenceApi = {
  /**
   * Get user-friendly intelligence summary (recommended for UI)
   * Combines IQ, knowledge levels, and recent evaluations
   */
  getSummary: () => {
    return apiClient.get<IntelligenceSummary>('/api/intelligence/summary');
  },

  /**
   * Get raw IQ level data (for internal/detailed views)
   */
  getIQLevel: () => {
    return apiClient.get<IQLevel>('/api/intelligence/iq');
  },

  /**
   * Get knowledge levels by subject
   * @param subject Optional - filter by specific subject
   */
  getKnowledgeLevels: (subject?: string) => {
    const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return apiClient.get<KnowledgeLevel[]>(`/api/intelligence/knowledge${params}`);
  },

  /**
   * Get evaluation history
   * @param limit Number of records to fetch (default 50, max 100)
   */
  getHistory: (limit = 50) => {
    return apiClient.get<EvaluationRecord[]>(`/api/intelligence/history?limit=${limit}`);
  },

  /**
   * Force recalculation of IQ and knowledge levels
   * Useful after data correction or manual adjustment
   */
  recalculate: () => {
    return apiClient.post<{ message: string; iq: IQLevel; knowledge: KnowledgeLevel[] }>(
      '/api/intelligence/recalculate'
    );
  },
};
