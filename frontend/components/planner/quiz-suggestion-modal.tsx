'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  RiTrophyLine,
  RiPlayCircleLine,
  RiTimeLine,
} from '@remixicon/react';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface QuizSuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterName: string;
  chapterId: string;
  subject: string;
}

export function QuizSuggestionModal({
  open,
  onOpenChange,
  chapterName,
  chapterId,
  subject,
}: QuizSuggestionModalProps) {
  const router = useRouter();

  // Trigger confetti when modal opens
  useEffect(() => {
    if (open) {
      // Slight delay for better effect
      const timer = setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
        });
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleTakeQuiz = () => {
    // Navigate to quiz page with pre-filled subject and chapter
    const params = new URLSearchParams({
      subject,
      chapter: chapterId,
      auto: 'true', // Auto-generate quiz
    });
    router.push(`/dashboard/quiz?${params.toString()}`);
    onOpenChange(false);
  };

  const handleMaybeLater = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <RiTrophyLine className="w-8 h-8 text-green-500" />
          </div>
          <DialogTitle className="text-xl">Chapter Completed!</DialogTitle>
          <DialogDescription className="text-base">
            Congratulations! You&apos;ve completed all topics in{' '}
            <span className="font-medium text-foreground">{chapterName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Test your knowledge with a quick quiz to reinforce what you&apos;ve learned.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleTakeQuiz}
            className="w-full bg-green-500 hover:bg-green-600"
            size="lg"
          >
            <RiPlayCircleLine className="w-5 h-5 mr-2" />
            Take Quiz Now
          </Button>
          <Button
            onClick={handleMaybeLater}
            variant="ghost"
            className="w-full"
            size="lg"
          >
            <RiTimeLine className="w-5 h-5 mr-2" />
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
