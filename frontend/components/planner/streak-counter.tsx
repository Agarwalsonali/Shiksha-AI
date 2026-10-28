'use client';

import { RiFireFill, RiFireLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  className?: string;
}

export function StreakCounter({
  currentStreak,
  longestStreak,
  className,
}: StreakCounterProps) {
  // Determine flame intensity based on streak
  const getFlameColor = () => {
    if (currentStreak >= 30) return 'text-orange-500';
    if (currentStreak >= 14) return 'text-orange-400';
    if (currentStreak >= 7) return 'text-yellow-500';
    if (currentStreak >= 3) return 'text-yellow-400';
    return 'text-muted-foreground';
  };

  const getFlameSize = () => {
    if (currentStreak >= 30) return 'w-7 h-7';
    if (currentStreak >= 14) return 'w-6 h-6';
    if (currentStreak >= 7) return 'w-5 h-5';
    return 'w-5 h-5';
  };

  const isActive = currentStreak > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'bg-muted/50 hover:bg-muted transition-colors cursor-default',
              isActive && 'bg-orange-500/10 hover:bg-orange-500/15',
              className
            )}
          >
            {isActive ? (
              <RiFireFill className={cn(getFlameSize(), getFlameColor(), 'animate-pulse')} />
            ) : (
              <RiFireLine className={cn('w-5 h-5', getFlameColor())} />
            )}
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                isActive ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
              )}
            >
              {currentStreak}
            </span>
            {currentStreak >= 7 && (
              <span className="text-xs text-muted-foreground">days</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-center">
          <p className="font-medium">
            {isActive ? `${currentStreak} day streak!` : 'No active streak'}
          </p>
          <p className="text-xs text-muted-foreground">
            Longest: {longestStreak} days
          </p>
          {!isActive && (
            <p className="text-xs text-muted-foreground mt-1">
              Complete a task to start your streak
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
