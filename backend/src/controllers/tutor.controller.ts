import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { NotFoundError, DatabaseError, ValidationError } from '../utils/apiError';
import { llmService } from '../services/llm.service';
import { ragService } from '../services/rag.service';
import { logger, logWarning } from '../utils/logger';
import type { AskQuestionInput } from '../schemas/tutor.schema';
import { getDetectionPrompt } from '../prompts';

// Maximum messages per session
const MAX_MESSAGES_PER_SESSION = 30;

/**
 * Detected topic interface
 */
interface DetectedTopic {
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  confidence: number;
}

/**
 * Stream tutor answer with RAG context
 * POST /api/tutor/ask
 * Server-Sent Events (SSE) streaming endpoint
 * 
 * Features:
 * - Uses gpt-4o for first question, gpt-4o-mini for follow-ups
 * - Auto-generates session title after first message
 * - Returns detected subject/chapter/topic in metadata
 * - Enforces 30 message limit per session
 */
export const askQuestion = async (req: AuthRequest, res: Response) => {
  const { session_id, question, answer_mode, subject, chapter }: AskQuestionInput = req.body;
  const userId = req.user!.id;

  try {
    // 1. Get user profile for context
    const { data: profileData, error: profileError } = await supabase
      .from('user_profile')
      .select('class, board, subjects')
      .eq('user_id', userId)
      .single();

    if (profileError || !profileData) {
      throw new DatabaseError('Failed to fetch user profile');
    }

    // 2. Get or create session, and check message count
    let sessionId = session_id;
    let isNewSession = false;
    let existingMessageCount = 0;
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (!sessionId) {
      // Create new session
      isNewSession = true;
      const { data: newSession, error: sessionError } = await supabase
        .from('tutor_sessions')
        .insert({ user_id: userId })
        .select()
        .single();

      if (sessionError || !newSession) {
        logger.error({ sessionError }, 'Failed to create session');
        throw new DatabaseError('Failed to create session');
      }
      sessionId = newSession.id;
    } else {
      // Get existing session
      const { data: session, error: sessionError } = await supabase
        .from('tutor_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (sessionError || !session) {
        throw new NotFoundError('Session not found');
      }

      // Count existing messages to check limit
      const { count } = await supabase
        .from('tutor_messages')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);
      
      existingMessageCount = count || 0;

      // Check message limit
      if (existingMessageCount >= MAX_MESSAGES_PER_SESSION) {
        throw new ValidationError(`Session has reached the maximum of ${MAX_MESSAGES_PER_SESSION} messages. Please start a new chat.`);
      }

      // Update last_active_at
      await supabase
        .from('tutor_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', sessionId);

      // Fetch conversation history for follow-up questions
      const { data: messages } = await supabase
        .from('tutor_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(20); // Limit for context efficiency

      if (messages && messages.length > 0) {
        conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      }
    }

    const isFollowUp = !isNewSession && existingMessageCount > 0;

    // 3. Detect topic in background (fire and forget)
    const detectionPromise = llmService
      .generateJSON<DetectedTopic>(
        getDetectionPrompt(question, profileData.class, profileData.board),
        ''
      )
      .catch((err) => {
        logWarning('Topic detection failed', { error: err.message, question });
        return { subject: null, chapter: null, topic: null, confidence: 0 } as DetectedTopic;
      });

    // 4. Search for NCERT context (RAG) - skip for very short/casual messages
    let ragContext = { contextText: '', chunks: [] as any[] };
    if (question.length > 15) {
      ragContext = await ragService.searchRelevantContext(
        question,
        {
          class: profileData.class,
          board: profileData.board,
          subject: subject || undefined,
          chapter: chapter || undefined,
        },
        5
      );
    }

    // 5. Prepare context for streaming
    const tutorContext = {
      studentClass: profileData.class,
      board: profileData.board,
      subject: subject || 'General',
      question,
      ragContext: ragContext.contextText,
      answerMode: answer_mode,
    };

    // 6. Setup SSE headers - IMPORTANT: These headers disable buffering
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Disable Nagle's algorithm for immediate packet sending
    if (res.socket) {
      res.socket.setNoDelay(true);
    }
    
    // Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // 7. Send initial metadata immediately (don't wait for detection)
    // Detection will be included in 'done' event
    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      session_id: sessionId,
      is_new_session: isNewSession,
      is_follow_up: isFollowUp,
      rag_results: ragContext.chunks.length,
    })}\n\n`);

    // 8. Start streaming AI response IMMEDIATELY
    // Use different models based on follow-up status
    let textStream;
    
    if (isFollowUp) {
      // Use smaller model for follow-up questions
      const result = await llmService.streamTutorFollowUp(
        tutorContext,
        conversationHistory,
        userId
      );
      textStream = result.textStream;
    } else {
      // Use full model with evaluation for first question
      const result = await llmService.streamTutorWithEvaluation(
        tutorContext,
        userId,
        sessionId as string
      );
      textStream = result.textStream;
    }

    // 9. Stream tokens - write each chunk immediately
    let fullResponse = '';
    for await (const chunk of textStream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: 'token', text: chunk })}\n\n`);
    }
    
    // 10. Wait for detection to complete (it's been running in parallel)
    const detection = await detectionPromise;

    // 10.5 Evaluate question for IQ tracking (fire and forget, only for first question)
    if (!isFollowUp) {
      llmService.evaluateQuestionForIQ(
        question,
        detection?.subject || subject || null,
        userId,
        sessionId as string
      ).catch((err) => {
        logWarning('IQ evaluation failed', { error: (err as Error).message });
      });
    }

    // 11. Save messages to database SEQUENTIALLY to ensure proper ordering
    // User message first
    const { data: userMessage, error: userMsgError } = await supabase
      .from('tutor_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: question,
        detected_class: profileData.class,
        detected_subject: detection.subject,
        detected_chapter: detection.chapter,
        detected_topic: detection.topic,
        detection_confidence: detection.confidence,
      })
      .select()
      .single();

    if (userMsgError) {
      logger.error({ error: userMsgError }, 'Failed to save user message');
    }

    // Assistant message second (ensures created_at is after user message)
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from('tutor_messages')
      .insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: fullResponse,
        answer_mode: answer_mode,
      })
      .select()
      .single();

    if (assistantMsgError) {
      logger.error({ error: assistantMsgError }, 'Failed to save assistant message');
    }

    // 12. Generate session title if this is the first message
    let sessionTitle: string | undefined;
    if (isNewSession || existingMessageCount === 0) {
      try {
        sessionTitle = await llmService.generateSessionTitle(
          question,
          detection.subject || subject || 'General',
          userId
        );
        // Title is derived from first message, no need to update session
        // (migration 03 adds title column, but we derive it from messages for backward compat)
      } catch (err) {
        logWarning('Failed to generate session title', { error: (err as Error).message });
        // Use truncated question as fallback title
        sessionTitle = question.slice(0, 50);
      }
    }

    // 13. Send completion event with detected topic
    res.write(`data: ${JSON.stringify({
      type: 'done',
      session_id: sessionId,
      session_title: sessionTitle,
      detected: {
        subject: detection.subject,
        chapter: detection.chapter,
        topic: detection.topic,
        confidence: detection.confidence,
      },
    })}\n\n`);
    res.end();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error({ errorMessage, errorStack, userId, question }, 'Error in askQuestion');
    
    if (!res.headersSent) {
      if (error instanceof ValidationError) {
        res.status(400).json(errorResponse(errorMessage, 'VALIDATION_ERROR'));
      } else if (error instanceof NotFoundError) {
        res.status(404).json(errorResponse(errorMessage, 'NOT_FOUND'));
      } else {
        res.status(500).json(errorResponse(
          'Failed to generate response. Please try again.',
          'TUTOR_ERROR'
        ));
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`);
      res.end();
    }
  }
};

/**
 * Get session with messages
 * GET /api/tutor/session/:session_id
 */
export const getSession = async (req: AuthRequest, res: Response) => {
  const { session_id } = req.params;
  const userId = req.user!.id;

  // Get session (only select base columns that always exist)
  const { data: session, error: sessionError } = await supabase
    .from('tutor_sessions')
    .select('id, started_at, last_active_at')
    .eq('id', session_id)
    .eq('user_id', userId)
    .single();

  if (sessionError || !session) {
    throw new NotFoundError('Session not found');
  }

  // Get messages
  const { data: messages, error: messagesError } = await supabase
    .from('tutor_messages')
    .select('id, role, content, detected_subject, detected_chapter, detected_topic, detection_confidence, answer_mode, created_at')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new DatabaseError(messagesError.message);
  }

  // Build session response with computed values
  const firstUserMessage = messages?.find(m => m.role === 'user');
  const sessionResponse = {
    id: session.id,
    title: firstUserMessage?.content?.slice(0, 50) || 'Untitled Chat',
    detected_subject: firstUserMessage?.detected_subject || null,
    detected_chapter: firstUserMessage?.detected_chapter || null,
    message_count: messages?.length || 0,
    started_at: session.started_at,
    last_active_at: session.last_active_at,
  };

  res.json(successResponse({ session: sessionResponse, messages }));
};

/**
 * List user sessions
 * GET /api/tutor/sessions
 */
export const listSessions = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  // Get sessions (only base columns)
  const { data, error, count } = await supabase
    .from('tutor_sessions')
    .select('id, started_at, last_active_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new DatabaseError(error.message);
  }

  // For each session, get the first message to derive title/subject
  const sessionsWithDetails = await Promise.all(
    (data || []).map(async (session) => {
      // Get first user message and count
      const { data: messages, count: msgCount } = await supabase
        .from('tutor_messages')
        .select('content, detected_subject, detected_chapter', { count: 'exact' })
        .eq('session_id', session.id)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .limit(1);

      const firstMessage = messages?.[0];
      
      return {
        id: session.id,
        title: firstMessage?.content?.slice(0, 50) || 'Untitled Chat',
        detected_subject: firstMessage?.detected_subject || null,
        detected_chapter: firstMessage?.detected_chapter || null,
        message_count: msgCount || 0,
        started_at: session.started_at,
        last_active_at: session.last_active_at,
      };
    })
  );

  res.json(successResponse({
    sessions: sessionsWithDetails,
    total: count,
    limit,
    offset,
  }));
};

/**
 * Delete session
 * DELETE /api/tutor/session/:session_id
 */
export const deleteSession = async (req: AuthRequest, res: Response) => {
  const { session_id } = req.params;
  const userId = req.user!.id;

  // Verify session belongs to user
  const { data: session, error: fetchError } = await supabase
    .from('tutor_sessions')
    .select('id')
    .eq('id', session_id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !session) {
    throw new NotFoundError('Session not found');
  }

  const { error } = await supabase
    .from('tutor_sessions')
    .delete()
    .eq('id', session_id)
    .eq('user_id', userId);

  if (error) {
    throw new DatabaseError(error.message);
  }

  res.json(successResponse(null, 'Session deleted successfully'));
};
