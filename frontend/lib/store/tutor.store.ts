/**
 * Tutor Store
 * Zustand store for AI Tutor state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tutorApi } from '@/lib/api/tutor.api';
import { toast } from 'sonner';
import type {
  AnswerMode,
  TutorSession,
  TutorMessage,
  DetectedTopic,
  AskQuestionParams,
  TutorMetadataEvent,
  TutorDoneEvent,
} from '@/lib/types/tutor.types';

interface TutorState {
  // Sessions
  sessions: TutorSession[];
  sessionsLoading: boolean;
  sessionsTotal: number;

  // Active session
  activeSessionId: string | null;
  messages: TutorMessage[];
  messagesLoading: boolean;

  // Streaming
  isStreaming: boolean;
  streamingContent: string;
  detectedTopic: DetectedTopic | null;

  // UI state
  answerMode: AnswerMode;
  sidebarOpen: boolean;

  // Actions
  fetchSessions: () => Promise<void>;
  selectSession: (sessionId: string | null) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (question: string, subject?: string, chapter?: string) => Promise<void>;
  setAnswerMode: (mode: AnswerMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  startNewChat: () => void;
  reset: () => void;
}

const initialState = {
  sessions: [],
  sessionsLoading: false,
  sessionsTotal: 0,
  activeSessionId: null,
  messages: [],
  messagesLoading: false,
  isStreaming: false,
  streamingContent: '',
  detectedTopic: null,
  answerMode: 'simple' as AnswerMode,
  sidebarOpen: true,
};

export const useTutorStore = create<TutorState>()(
  persist(
    (set, get) => ({
      ...initialState,

      fetchSessions: async () => {
        set({ sessionsLoading: true });
        try {
          const response = await tutorApi.listSessions(50, 0);
          set({
            sessions: response.sessions,
            sessionsTotal: response.total,
          });
        } catch (error) {
          console.error('Failed to fetch sessions:', error);
        } finally {
          set({ sessionsLoading: false });
        }
      },

      selectSession: async (sessionId: string | null) => {
        if (!sessionId) {
          set({ activeSessionId: null, messages: [], detectedTopic: null });
          return;
        }

        // Don't reload if already selected
        if (get().activeSessionId === sessionId) return;

        set({ messagesLoading: true, activeSessionId: sessionId });
        try {
          const response = await tutorApi.getSession(sessionId);
          set({
            messages: response.messages,
            detectedTopic: response.session.detected_subject
              ? {
                  subject: response.session.detected_subject,
                  chapter: response.session.detected_chapter,
                  topic: null,
                  confidence: 1,
                }
              : null,
          });
        } catch (error) {
          console.error('Failed to fetch session:', error);
          toast.error('Failed to load conversation');
          set({ activeSessionId: null, messages: [] });
        } finally {
          set({ messagesLoading: false });
        }
      },

      deleteSession: async (sessionId: string) => {
        try {
          await tutorApi.deleteSession(sessionId);
          
          // Remove from local state
          set((state) => ({
            sessions: state.sessions.filter((s) => s.id !== sessionId),
            sessionsTotal: state.sessionsTotal - 1,
            // Clear active session if it was deleted
            ...(state.activeSessionId === sessionId
              ? { activeSessionId: null, messages: [], detectedTopic: null }
              : {}),
          }));
          
          toast.success('Chat deleted');
        } catch (error) {
          console.error('Failed to delete session:', error);
          toast.error('Failed to delete chat');
        }
      },

      sendMessage: async (question: string, subject?: string, chapter?: string) => {
        const { activeSessionId, answerMode } = get();

        // Add user message optimistically
        const tempUserMessageId = `temp-user-${Date.now()}`;
        const userMessage: TutorMessage = {
          id: tempUserMessageId,
          session_id: activeSessionId || '',
          role: 'user',
          content: question,
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          isStreaming: true,
          streamingContent: '',
        }));

        try {
          const params: AskQuestionParams = {
            question,
            answer_mode: answerMode,
            ...(activeSessionId ? { session_id: activeSessionId } : {}),
            ...(subject ? { subject } : {}),
            ...(chapter ? { chapter } : {}),
          };

          const response = await tutorApi.askQuestion(params);
          
          let sessionId = activeSessionId;
          let sessionTitle: string | undefined;
          let detected: DetectedTopic | null = null;
          // Track accumulated content locally to avoid race conditions
          let accumulatedContent = '';

          // Process SSE stream
          for await (const event of tutorApi.streamEvents(response)) {
            switch (event.type) {
              case 'metadata': {
                const metadata = event as TutorMetadataEvent;
                sessionId = metadata.session_id;
                // Detected topic now comes in 'done' event, not metadata
                if (metadata.detected) {
                  detected = metadata.detected;
                  set({ detectedTopic: detected });
                }
                // Update activeSessionId AND fix the user message's session_id
                set((state) => ({
                  activeSessionId: sessionId,
                  // Update the temp user message with the real session_id
                  messages: state.messages.map((m) =>
                    m.id === tempUserMessageId && sessionId
                      ? { ...m, session_id: sessionId }
                      : m
                  ),
                }));
                break;
              }
              case 'token':
                // Accumulate locally AND update state
                accumulatedContent += event.text;
                set((state) => ({
                  streamingContent: state.streamingContent + event.text,
                }));
                break;
              case 'done': {
                const doneEvent = event as TutorDoneEvent;
                sessionTitle = doneEvent.session_title;
                // Get detected topic from done event
                if (doneEvent.detected) {
                  detected = doneEvent.detected;
                  set({ detectedTopic: detected });
                }
                break;
              }
              case 'error':
                throw new Error(event.message);
            }
          }

          // Finalize: add assistant message using locally accumulated content
          // This avoids any potential race condition with get().streamingContent
          const finalContent = accumulatedContent || get().streamingContent;
          
          const assistantMessage: TutorMessage = {
            id: `msg-${Date.now()}`,
            session_id: sessionId || '',
            role: 'assistant',
            content: finalContent,
            detected_subject: detected?.subject,
            detected_chapter: detected?.chapter,
            detected_topic: detected?.topic,
            detection_confidence: detected?.confidence,
            answer_mode: answerMode,
            created_at: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            streamingContent: '',
            isStreaming: false,
            detectedTopic: detected,
          }));

          // Update sessions list with new/updated session
          if (sessionId) {
            const existingSession = get().sessions.find((s) => s.id === sessionId);
            
            if (!existingSession && sessionTitle) {
              // New session - add to top
              const newSession: TutorSession = {
                id: sessionId,
                title: sessionTitle,
                detected_subject: detected?.subject || null,
                detected_chapter: detected?.chapter || null,
                message_count: 2,
                started_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
              };
              set((state) => ({
                sessions: [newSession, ...state.sessions],
                sessionsTotal: state.sessionsTotal + 1,
              }));
            } else if (existingSession) {
              // Update existing session
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId
                    ? {
                        ...s,
                        message_count: s.message_count + 2,
                        last_active_at: new Date().toISOString(),
                        ...(sessionTitle ? { title: sessionTitle } : {}),
                      }
                    : s
                ),
              }));
            }
          }
        } catch (error) {
          console.error('Failed to send message:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to send message');
          
          // Remove optimistic user message on error
          set((state) => ({
            messages: state.messages.filter((m) => m.id !== tempUserMessageId),
            isStreaming: false,
            streamingContent: '',
          }));
        }
      },

      setAnswerMode: (mode: AnswerMode) => {
        set({ answerMode: mode });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },

      startNewChat: () => {
        set({
          activeSessionId: null,
          messages: [],
          detectedTopic: null,
          streamingContent: '',
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'shiksha-tutor-storage',
      partialize: (state) => ({
        answerMode: state.answerMode,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
