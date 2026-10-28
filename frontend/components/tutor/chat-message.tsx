'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RiSparklingLine, RiUser3Line } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/ui/markdown';
import type { TutorMessage } from '@/lib/types/tutor.types';

interface ChatMessageProps {
  message: TutorMessage;
  userName?: string;
  isStreaming?: boolean;
}

function getInitials(name?: string) {
  if (!name) return null;
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ChatMessage({ message, userName, isStreaming }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const initials = getInitials(userName);

  return (
    <div
      className={cn(
        'group relative flex gap-3 sm:gap-4',
        !isAssistant && 'flex-row-reverse'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {isAssistant ? (
          <AvatarFallback className="bg-primary text-primary-foreground">
            <RiSparklingLine className="h-4 w-4" />
          </AvatarFallback>
        ) : (
          <AvatarFallback className="bg-muted">
            {initials || <RiUser3Line className="h-4 w-4" />}
          </AvatarFallback>
        )}
      </Avatar>

      <div className={cn('flex-1 space-y-1.5 overflow-hidden', !isAssistant && 'text-right')}>
        <div className={cn('flex items-center gap-2', !isAssistant && 'justify-end')}>
          <span className="text-sm font-medium text-foreground">
            {isAssistant ? 'Shiksha AI' : userName || 'You'}
          </span>
        </div>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm leading-relaxed',
            isAssistant 
              ? 'bg-muted/50 text-left p-6'
              : 'bg-primary text-primary-foreground inline-block ml-auto max-w-[85%]'
          )}
        >
          {isAssistant ? (
            <>
              <Markdown content={message.content} />
              {isStreaming && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground ml-0.5 align-middle" />
              )}
            </>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StreamingIndicator() {
  return (
    <div className="flex gap-3 sm:gap-4">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <RiSparklingLine className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1.5">
        <span className="text-sm font-medium text-foreground">Shiksha AI</span>
        <div className="flex items-center gap-1 py-2">
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
