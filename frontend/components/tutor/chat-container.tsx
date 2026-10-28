'use client';

import { useRef, useEffect } from 'react';
import { useTutorStore } from '@/lib/store/tutor.store';
import { useAuth } from '@/lib/hooks/use-auth';
import { ChatMessage, StreamingIndicator } from './chat-message';
import { EmptyState } from './empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { TutorMessage } from '@/lib/types/tutor.types';

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const {
    messages,
    messagesLoading,
    isStreaming,
    streamingContent,
  } = useTutorStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Show empty state
  if (!messagesLoading && messages.length === 0) {
    return <EmptyState />;
  }

  // Show loading skeleton
  if (messagesLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Create streaming message if there's content being streamed
  const streamingMessage: TutorMessage | null = streamingContent
    ? {
        id: 'streaming',
        session_id: '',
        role: 'assistant',
        content: streamingContent,
        created_at: new Date().toISOString(),
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="space-y-6">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            userName={user?.name}
          />
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <ChatMessage
            message={streamingMessage}
            userName={user?.name}
            isStreaming
          />
        )}

        {/* Waiting indicator (shown before first token arrives) */}
        {isStreaming && !streamingContent && messages[messages.length - 1]?.role === 'user' && (
          <StreamingIndicator />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
