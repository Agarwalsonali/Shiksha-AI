'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RiSendPlane2Line, RiStopCircleLine } from '@remixicon/react';
import { useTutorStore } from '@/lib/store/tutor.store';
import { ModeSelector } from './mode-selector';
import { DetectedTopicBadge } from './detected-topic-badge';

export function ChatInput() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isStreaming, messages } = useTutorStore();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isStreaming) return;

      const question = input.trim();
      setInput('');
      await sendMessage(question);
    },
    [input, isStreaming, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Check message limit (30 messages = 15 exchanges)
  const messageCount = messages.length;
  const isAtLimit = messageCount >= 30;

  return (
    <div className="border-t bg-background shrink-0">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {isAtLimit && (
          <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
            This chat has reached the maximum of 30 messages. Please start a new chat to continue.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Mode selector and detected topic */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <ModeSelector />
            <DetectedTopicBadge />
          </div>
          
          {/* Textarea with send button */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAtLimit ? 'Start a new chat to continue...' : 'Message Shiksha AI...'}
              disabled={isStreaming || isAtLimit}
              className="min-h-[52px] resize-none pr-12 text-sm"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isStreaming || !input.trim() || isAtLimit}
              className="absolute bottom-2 right-2 h-8 w-8"
            >
              {isStreaming ? (
                <RiStopCircleLine className="h-4 w-4" />
              ) : (
                <RiSendPlane2Line className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Shiksha AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}
