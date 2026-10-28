'use client';

import {
  RiSparklingLine,
  RiAtomLine,
  RiFlaskLine,
  RiSeedlingLine,
  RiCalculatorLine,
  RiMicroscopeLine,
  RiGlobalLine,
  RiHistoryLine,
  RiMapPinLine,
  RiPencilLine,
  RiLightbulbLine,
  RiGraduationCapLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTutorStore } from '@/lib/store/tutor.store';
import { getSuggestedQuestions, type SubjectIconType } from '@/lib/types/tutor.types';

// Map icon types to actual icon components
const SUBJECT_ICON_MAP: Record<SubjectIconType, React.ComponentType<{ className?: string }>> = {
  atom: RiAtomLine,
  flask: RiFlaskLine,
  seedling: RiSeedlingLine,
  calculator: RiCalculatorLine,
  microscope: RiMicroscopeLine,
  globe: RiGlobalLine,
  history: RiHistoryLine,
  map: RiMapPinLine,
  pencil: RiPencilLine,
  lightbulb: RiLightbulbLine,
  graduation: RiGraduationCapLine,
};

export function EmptyState() {
  const { profile } = useAuth();
  const { sendMessage, isStreaming } = useTutorStore();

  // Get user's subjects or default ones
  const subjects = profile?.subjects || ['Physics', 'Chemistry', 'Mathematics'];
  const suggestedQuestions = getSuggestedQuestions(subjects);

  const handleQuestionClick = async (question: string) => {
    if (isStreaming) return;
    await sendMessage(question);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <RiSparklingLine className="h-10 w-10 text-primary" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">How can I help you today?</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        Ask me anything about your subjects, and I'll help you learn! Choose a
        question below or type your own.
      </p>

      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {suggestedQuestions.slice(0, 6).map((q, index) => {
          const Icon = SUBJECT_ICON_MAP[q.iconType];
          return (
            <Button
              key={index}
              variant="outline"
              className="h-auto min-h-[4rem] justify-start gap-3 p-3 text-left"
              onClick={() => handleQuestionClick(q.text)}
              disabled={isStreaming}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="flex-1 text-sm leading-snug line-clamp-2">{q.text}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
