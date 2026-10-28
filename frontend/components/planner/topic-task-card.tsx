'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  RiTimeLine,
  RiBookOpenLine,
  RiPlayCircleLine,
  RiCheckLine,
  RiLoader4Line,
  RiArrowRightSLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { PlanTask, TaskStatus, Priority } from '@/lib/types/planner.types';

interface TopicTaskCardProps {
  task: PlanTask;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  showChapter?: boolean;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
};

const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  study: <RiBookOpenLine className="w-4 h-4" />,
  read: <RiBookOpenLine className="w-4 h-4" />,
  quiz: <RiPlayCircleLine className="w-4 h-4" />,
  revision: <RiCheckLine className="w-4 h-4" />,
  practice: <RiBookOpenLine className="w-4 h-4" />,
  solve: <RiBookOpenLine className="w-4 h-4" />,
};

export function TopicTaskCard({
  task,
  onStatusChange,
  showChapter = false,
}: TopicTaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const isCompleted = task.status === 'completed';
  const isQuiz = task.task_type === 'quiz';

  const handleToggle = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const newStatus: TaskStatus = isCompleted ? 'pending' : 'completed';
      await onStatusChange(task.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  // Extract priority from topic if available (format: "TopicName [HIGH]")
  const getPriority = (): Priority => {
    if (task.topic?.includes('[HIGH]')) return 'high';
    if (task.topic?.includes('[LOW]')) return 'low';
    return 'medium';
  };

  const priority = getPriority();
  const topicName = task.topic?.replace(/\s*\[(HIGH|MEDIUM|LOW)\]/i, '') || 'Unknown topic';

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isCompleted && 'opacity-60 bg-muted/30'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-0.5">
            {isUpdating ? (
              <RiLoader4Line className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <Checkbox
                checked={isCompleted}
                onCheckedChange={handleToggle}
                className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Topic name */}
                <p
                  className={cn(
                    'font-medium text-sm',
                    isCompleted && 'line-through text-muted-foreground'
                  )}
                >
                  {topicName}
                </p>

                {/* Chapter info */}
                {showChapter && task.chapter && (
                  <p className="text-xs text-muted-foreground mt-0.5">{task.chapter}</p>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {/* Task type */}
                  <Badge variant="outline" className="text-xs gap-1">
                    {TASK_TYPE_ICONS[task.task_type] || <RiBookOpenLine className="w-3 h-3" />}
                    {task.task_type}
                  </Badge>

                  {/* Priority */}
                  <Badge variant="outline" className={cn('text-xs', PRIORITY_COLORS[priority])}>
                    {priority}
                  </Badge>

                  {/* Duration */}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RiTimeLine className="w-3 h-3" />
                    {task.duration_min} min
                  </span>
                </div>
              </div>

              {/* Quiz action */}
              {isQuiz && isCompleted && (
                <Button size="sm" variant="outline" className="shrink-0">
                  View Results
                  <RiArrowRightSLine className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for lists
export function TopicTaskRow({
  task,
  onStatusChange,
}: {
  task: PlanTask;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const isCompleted = task.status === 'completed';

  const handleToggle = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const newStatus: TaskStatus = isCompleted ? 'pending' : 'completed';
      await onStatusChange(task.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const topicName = task.topic?.replace(/\s*\[(HIGH|MEDIUM|LOW)\]/i, '') || 'Unknown topic';

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 px-4 border-b last:border-b-0',
        'hover:bg-muted/50 transition-colors',
        isCompleted && 'opacity-60'
      )}
    >
      {/* Checkbox */}
      {isUpdating ? (
        <RiLoader4Line className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggle}
          className="shrink-0 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
        />
      )}

      {/* Icon */}
      <span className="text-muted-foreground shrink-0">
        {TASK_TYPE_ICONS[task.task_type] || <RiBookOpenLine className="w-4 h-4" />}
      </span>

      {/* Topic */}
      <span
        className={cn(
          'flex-1 text-sm truncate',
          isCompleted && 'line-through text-muted-foreground'
        )}
      >
        {topicName}
      </span>

      {/* Duration */}
      <span className="text-xs text-muted-foreground shrink-0">{task.duration_min} min</span>
    </div>
  );
}
