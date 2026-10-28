/**
 * Tutor API Service
 * Handles AI tutor endpoints with SSE streaming support
 */

import { apiClient, API_URL } from './client';
import type {
  ListSessionsResponse,
  GetSessionResponse,
  AskQuestionParams,
  TutorSSEEvent,
} from '@/lib/types/tutor.types';

/**
 * Parse SSE event data from a chunk
 */
const parseSSEEvent = (line: string): TutorSSEEvent | null => {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6)) as TutorSSEEvent;
  } catch {
    return null;
  }
};

/**
 * Tutor API endpoints
 */
export const tutorApi = {
  /**
   * List user's tutor sessions
   */
  listSessions: async (limit = 50, offset = 0): Promise<ListSessionsResponse> => {
    return apiClient.get<ListSessionsResponse>(
      `/api/tutor/sessions?limit=${limit}&offset=${offset}`
    );
  },

  /**
   * Get a specific session with its messages
   */
  getSession: async (sessionId: string): Promise<GetSessionResponse> => {
    return apiClient.get<GetSessionResponse>(`/api/tutor/session/${sessionId}`);
  },

  /**
   * Delete a session
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    return apiClient.delete<void>(`/api/tutor/session/${sessionId}`);
  },

  /**
   * Ask a question to the AI tutor (SSE streaming)
   * Returns the raw Response object for SSE handling
   */
  askQuestion: async (params: AskQuestionParams): Promise<Response> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const response = await fetch(`${API_URL}/api/tutor/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Failed to send question');
    }

    return response;
  },

  /**
   * Stream and process SSE events from a Response
   * Yields parsed events as they arrive
   */
  streamEvents: async function* (
    response: Response
  ): AsyncGenerator<TutorSSEEvent, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          const event = parseSSEEvent(trimmed);
          if (event) yield event;
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const event = parseSSEEvent(buffer.trim());
        if (event) yield event;
      }
    } finally {
      reader.releaseLock();
    }
  },
};
