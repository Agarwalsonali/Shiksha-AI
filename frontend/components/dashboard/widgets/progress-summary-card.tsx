'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RiBookOpenLine, RiArrowRightLine, RiCheckLine, RiTimeLine } from '@remixicon/react';
import { progressApi } from '@/lib/api/progress.api';
import type { CurriculumWithProgress, SubjectWithProgress } from '@/lib/types/progress.types';

interface ProgressSummaryCardProps {
  compact?: boolean;
}

export function ProgressSummaryCard({ compact = false }: ProgressSummaryCardProps) {
  const [curriculum, setCurriculum] = useState<CurriculumWithProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const data = await progressApi.getCurriculumWithProgress();
      setCurriculum(data);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ProgressSummaryCardSkeleton compact={compact} />;
  }

  if (!curriculum) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RiBookOpenLine className="h-5 w-5 text-blue-500" />
            Learning Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Complete your profile to track progress
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { overall_stats, subjects } = curriculum;

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Progress</CardTitle>
          <RiBookOpenLine className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overall_stats.overall_progress_percent}%</div>
          <Progress value={overall_stats.overall_progress_percent} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {overall_stats.completed_chapters}/{overall_stats.total_chapters} chapters
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get top 3 subjects with most progress or most chapters
  const topSubjects = [...subjects]
    .sort((a, b) => b.overall_progress_percent - a.overall_progress_percent)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RiBookOpenLine className="h-5 w-5 text-blue-500" />
            Learning Progress
          </CardTitle>
          <CardDescription>Your curriculum completion status</CardDescription>
        </div>
        <Link href="/dashboard/progress">
          <Button variant="ghost" size="sm">
            View All
            <RiArrowRightLine className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              {overall_stats.completed_chapters}/{overall_stats.total_chapters} chapters
            </span>
          </div>
          <Progress value={overall_stats.overall_progress_percent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <RiCheckLine className="h-3 w-3 text-green-500" />
              {overall_stats.completed_chapters} completed
            </span>
            <span className="flex items-center gap-1">
              <RiTimeLine className="h-3 w-3 text-blue-500" />
              {overall_stats.in_progress_chapters} in progress
            </span>
          </div>
        </div>

        {/* Subject Progress */}
        <div className="space-y-3">
          {topSubjects.map((subject) => (
            <div key={subject.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{subject.icon}</span>
                  <span className="font-medium">{subject.name}</span>
                </span>
                <span className="text-muted-foreground">{subject.overall_progress_percent}%</span>
              </div>
              <Progress value={subject.overall_progress_percent} className="h-2" />
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="flex justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>{overall_stats.total_subjects} subjects</span>
          <span>Class {curriculum.class} - {curriculum.board}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function ProgressSummaryCardSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-2 w-full mt-2" />
          <Skeleton className="h-3 w-24 mt-1" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
