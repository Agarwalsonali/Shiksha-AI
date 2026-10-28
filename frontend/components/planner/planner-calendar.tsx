'use client';

import * as React from 'react';
import { DayPicker, getDefaultClassNames, type DayButton } from 'react-day-picker';
import { RiArrowLeftSLine, RiArrowRightSLine, RiFireFill } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

interface PlannerCalendarProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  studyDates?: string[]; // ISO date strings of days user studied
  taskDates?: string[]; // ISO date strings of days with scheduled tasks
  className?: string;
}

// Custom day button component - extracted to its own component to properly use hooks
function CustomDayButton({
  day,
  modifiers,
  className: dayClassName,
  studyDatesSet,
  taskDatesSet,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  studyDatesSet: Set<string>;
  taskDatesSet: Set<string>;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const dateStr = day.date.toISOString().split('T')[0];
  const hasStudied = studyDatesSet.has(dateStr!);
  const hasTask = taskDatesSet.has(dateStr!);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-has-studied={hasStudied}
      data-has-task={hasTask}
      className={cn(
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
        'dark:hover:text-foreground relative flex w-8 h-8 items-center justify-center',
        'leading-none font-normal rounded-md text-sm',
        hasTask && !hasStudied && 'bg-blue-500/10',
        dayClassName
      )}
      {...props}
    >
      <span className="text-sm">{day.date.getDate()}</span>
      {hasStudied && (
        <RiFireFill className="w-3 h-3 text-orange-500 absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
      )}
      {hasTask && !hasStudied && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
      )}
    </Button>
  );
}

export function PlannerCalendar({
  selected,
  onSelect,
  studyDates = [],
  taskDates = [],
  className,
}: PlannerCalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  // Convert string dates to Set for O(1) lookup
  const studyDatesSet = React.useMemo(() => new Set(studyDates), [studyDates]);
  const taskDatesSet = React.useMemo(() => new Set(taskDates), [taskDates]);

  // Wrapper component that passes the sets to CustomDayButton
  const DayButtonWrapper = React.useCallback(
    (props: React.ComponentProps<typeof DayButton>) => (
      <CustomDayButton
        {...props}
        studyDatesSet={studyDatesSet}
        taskDatesSet={taskDatesSet}
      />
    ),
    [studyDatesSet, taskDatesSet]
  );

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={onSelect}
      showOutsideDays
      className={cn(
        'p-2 bg-background',
        className
      )}
      classNames={{
        root: cn('w-fit mx-auto', defaultClassNames.root),
        months: cn('flex flex-col relative', defaultClassNames.months),
        month: cn('flex flex-col gap-2', defaultClassNames.month),
        nav: cn(
          'flex items-center justify-between w-full mb-2',
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-7 p-0',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-7 p-0',
          defaultClassNames.button_next
        ),
        month_caption: cn(
          'flex items-center justify-center',
          defaultClassNames.month_caption
        ),
        caption_label: cn('select-none font-medium text-sm', defaultClassNames.caption_label),
        table: 'border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground w-8 font-normal text-xs select-none text-center',
          defaultClassNames.weekday
        ),
        week: cn('flex mt-1', defaultClassNames.week),
        day: cn(
          'relative w-8 h-8 rounded-md p-0 text-center group/day select-none',
          defaultClassNames.day
        ),
        today: cn(
          'bg-accent text-accent-foreground rounded-md',
          defaultClassNames.today
        ),
        outside: cn('text-muted-foreground opacity-50', defaultClassNames.outside),
        disabled: cn('text-muted-foreground opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
      }}
      components={{
        Chevron: ({ orientation, ...props }) => {
          if (orientation === 'left') {
            return <RiArrowLeftSLine className="size-4" {...props} />;
          }
          return <RiArrowRightSLine className="size-4" {...props} />;
        },
        DayButton: DayButtonWrapper,
      }}
    />
  );
}

// Legend component for the calendar
export function CalendarLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 justify-center">
      <div className="flex items-center gap-1.5">
        <RiFireFill className="w-3 h-3 text-orange-500" />
        <span>Studied</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        <span>Scheduled</span>
      </div>
    </div>
  );
}
