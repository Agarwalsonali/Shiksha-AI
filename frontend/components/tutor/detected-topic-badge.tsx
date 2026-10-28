'use client';

import { Badge } from '@/components/ui/badge';
import { useTutorStore } from '@/lib/store/tutor.store';
import { RiBookLine } from '@remixicon/react';

export function DetectedTopicBadge() {
  const { detectedTopic } = useTutorStore();

  if (!detectedTopic?.subject) return null;

  const parts = [
    detectedTopic.subject,
    detectedTopic.chapter,
    detectedTopic.topic,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <RiBookLine className="h-3.5 w-3.5" />
      <div className="flex items-center gap-1">
        {parts.map((part, index) => (
          <span key={index} className="flex items-center">
            {index > 0 && <span className="mx-1 text-muted-foreground/50">/</span>}
            <Badge variant="secondary" className="text-xs font-normal px-1.5 py-0">
              {part}
            </Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
