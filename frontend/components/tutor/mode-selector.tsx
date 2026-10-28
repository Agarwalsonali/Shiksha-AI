'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  RiArrowDownSLine,
  RiLightbulbLine,
  RiFlashlightLine,
  RiBookOpenLine,
  RiFocus3Line,
} from '@remixicon/react';
import { useTutorStore } from '@/lib/store/tutor.store';
import { ANSWER_MODES, type AnswerMode, type AnswerModeIconType } from '@/lib/types/tutor.types';

// Map icon types to actual icon components
const ICON_MAP: Record<AnswerModeIconType, React.ComponentType<{ className?: string }>> = {
  lightbulb: RiLightbulbLine,
  flashlight: RiFlashlightLine,
  book: RiBookOpenLine,
  focus: RiFocus3Line,
};

export function ModeSelector() {
  const { answerMode, setAnswerMode, isStreaming } = useTutorStore();
  const currentMode = ANSWER_MODES[answerMode];
  const CurrentIcon = ICON_MAP[currentMode.iconType];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={isStreaming}
        >
          <CurrentIcon className="h-3.5 w-3.5" />
          <span>{currentMode.label}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuRadioGroup
          value={answerMode}
          onValueChange={(value) => setAnswerMode(value as AnswerMode)}
        >
          {(Object.entries(ANSWER_MODES) as [AnswerMode, typeof currentMode][]).map(
            ([mode, config]) => {
              const Icon = ICON_MAP[config.iconType];
              return (
                <DropdownMenuRadioItem
                  key={mode}
                  value={mode}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">
                    {config.description}
                  </span>
                </DropdownMenuRadioItem>
              );
            }
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
