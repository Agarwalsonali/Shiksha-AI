'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RiMoreLine, RiDeleteBinLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { TutorSession } from '@/lib/types/tutor.types';

interface SessionItemProps {
  session: TutorSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SessionItem({ session, isActive, onSelect, onDelete }: SessionItemProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      {/* Text content - takes remaining space with overflow hidden */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium">
          {(session.title || 'Untitled Chat').slice(0, 26)}
          {(session.title || 'Untitled Chat').length > 26 && '...'}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {session.detected_subject && (
            <span className="truncate">{session.detected_subject}</span>
          )}
          <span className="shrink-0">{formatRelativeTime(session.last_active_at)}</span>
        </div>
      </div>

      {/* Menu button - absolutely positioned to prevent overflow */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <RiMoreLine className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <RiDeleteBinLine className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
