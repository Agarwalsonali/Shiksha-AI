'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  RiBookOpenLine,
  RiCheckLine,
  RiTimeLine,
  RiEditLine,
  RiFilterLine,
  RiAtomLine,
  RiFlaskLine,
  RiCalculatorLine,
  RiPlantLine,
  RiEarthLine,
  RiTranslate2,
  RiBookLine,
  RiHistoryLine,
  RiGlobalLine,
  RiComputerLine,
  RiSaveLine,
  RiCloseLine,
  RiLoader4Line,
  RiArrowGoBackLine,
} from '@remixicon/react';
import { progressApi } from '@/lib/api/progress.api';
import type {
  CurriculumWithProgress,
  SubjectWithProgress,
  ChapterWithProgress,
  ChapterStatus,
  SystemTag,
} from '@/lib/types/progress.types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Subject icon mapping
const SUBJECT_ICONS: Record<string, React.ReactNode> = {
  atom: <RiAtomLine className="h-5 w-5" />,
  flask: <RiFlaskLine className="h-5 w-5" />,
  calculator: <RiCalculatorLine className="h-5 w-5" />,
  plant: <RiPlantLine className="h-5 w-5" />,
  earth: <RiEarthLine className="h-5 w-5" />,
  translate: <RiTranslate2 className="h-5 w-5" />,
  book: <RiBookLine className="h-5 w-5" />,
  history: <RiHistoryLine className="h-5 w-5" />,
  global: <RiGlobalLine className="h-5 w-5" />,
  computer: <RiComputerLine className="h-5 w-5" />,
};

// Helper function to get subject icon
const getSubjectIcon = (iconName: string) => {
  return SUBJECT_ICONS[iconName] || <RiBookOpenLine className="h-5 w-5" />;
};

// Status badge colors
const STATUS_COLORS: Record<ChapterStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-green-500/10 text-green-500',
};

const STATUS_LABELS: Record<ChapterStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

// Tag colors
const TAG_COLORS: Record<SystemTag, string> = {
  need_revision: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  important: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  difficult: 'bg-red-500/10 text-red-500 border-red-500/20',
  easy: 'bg-green-500/10 text-green-500 border-green-500/20',
  exam_important: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const TAG_LABELS: Record<SystemTag, string> = {
  need_revision: 'Needs Revision',
  important: 'Important',
  difficult: 'Difficult',
  easy: 'Easy',
  exam_important: 'Exam Important',
  completed: 'Completed',
};

export default function ProgressPage() {
  const [curriculum, setCurriculum] = useState<CurriculumWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ChapterStatus | 'all'>('all');

  useEffect(() => {
    fetchCurriculum();
  }, []);

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      const data = await progressApi.getCurriculumWithProgress();
      setCurriculum(data);
      // Default to first subject or 'all'
      if (data.subjects.length > 0) {
        setActiveSubject('all');
      }
    } catch (error) {
      console.error('Failed to fetch curriculum:', error);
      toast.error('Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  };

  // Helper to update a chapter in the curriculum state
  const updateChapterInState = useCallback((chapterId: string, updates: Partial<ChapterWithProgress>) => {
    setCurriculum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map(subject => ({
          ...subject,
          chapters: subject.chapters.map(chapter =>
            chapter.id === chapterId ? { ...chapter, ...updates } : chapter
          ),
        })),
      };
    });
  }, []);

  const handleUpdateProgress = async (chapterId: string, status: ChapterStatus) => {
    const progressPercent = status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0;
    
    // Optimistic update
    updateChapterInState(chapterId, {
      status,
      progress_percent: progressPercent,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      ...(status === 'in_progress' && !curriculum?.subjects.some(s => 
        s.chapters.some(c => c.id === chapterId && c.started_at)
      ) ? { started_at: new Date().toISOString() } : {}),
    });

    try {
      await progressApi.updateChapterProgress(chapterId, {
        status,
        progress_percent: progressPercent,
      });
      toast.success('Progress updated');
    } catch (error) {
      console.error('Failed to update progress:', error);
      // Revert on error by refetching
      fetchCurriculum();
    }
  };

  const handleAddTag = async (chapterId: string, tag: SystemTag) => {
    // Optimistic update
    setCurriculum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map(subject => ({
          ...subject,
          chapters: subject.chapters.map(chapter =>
            chapter.id === chapterId 
              ? { ...chapter, system_tags: [...chapter.system_tags, tag] }
              : chapter
          ),
        })),
      };
    });

    try {
      await progressApi.addTag(chapterId, { tag, type: 'system' });
      toast.success(`Tag "${TAG_LABELS[tag]}" added`);
    } catch (error) {
      console.error('Failed to add tag:', error);
      fetchCurriculum();
    }
  };

  const handleRemoveTag = async (chapterId: string, tag: string) => {
    // Optimistic update
    setCurriculum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map(subject => ({
          ...subject,
          chapters: subject.chapters.map(chapter =>
            chapter.id === chapterId 
              ? { 
                  ...chapter, 
                  system_tags: chapter.system_tags.filter(t => t !== tag),
                  custom_tags: chapter.custom_tags.filter(t => t !== tag),
                }
              : chapter
          ),
        })),
      };
    });

    try {
      await progressApi.removeTag(chapterId, tag);
      toast.success('Tag removed');
    } catch (error) {
      console.error('Failed to remove tag:', error);
      fetchCurriculum();
    }
  };

  const handleUpdateNotes = async (chapterId: string, notes: string) => {
    // Optimistic update
    updateChapterInState(chapterId, { notes: notes || null });

    try {
      await progressApi.updateChapterProgress(chapterId, { notes });
      toast.success('Notes saved');
    } catch (error) {
      console.error('Failed to save notes:', error);
      fetchCurriculum();
    }
  };

  // Filter subjects based on active tab
  const filteredSubjects = curriculum?.subjects.filter((subject) => {
    if (activeSubject === 'all') return true;
    return subject.id === activeSubject;
  }) || [];

  // Filter chapters based on status filter
  const filterChapters = (chapters: ChapterWithProgress[]) => {
    if (statusFilter === 'all') return chapters;
    return chapters.filter((ch) => ch.status === statusFilter);
  };

  if (loading) {
    return <ProgressSkeleton />;
  }

  if (!curriculum) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RiBookOpenLine className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No curriculum found</h2>
        <p className="text-muted-foreground">Please complete your profile to see your curriculum.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Progress</h1>
          <p className="text-muted-foreground">
            Track your learning progress across all subjects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            Class {curriculum.class} - {curriculum.board}
          </Badge>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <RiCheckLine className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{curriculum.overall_stats.overall_progress_percent}%</div>
            <Progress value={curriculum.overall_stats.overall_progress_percent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {curriculum.overall_stats.completed_chapters}/{curriculum.overall_stats.total_chapters} chapters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <RiCheckLine className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{curriculum.overall_stats.completed_chapters}</div>
            <p className="text-xs text-muted-foreground">chapters completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <RiTimeLine className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{curriculum.overall_stats.in_progress_chapters}</div>
            <p className="text-xs text-muted-foreground">chapters in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            <RiBookOpenLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{curriculum.overall_stats.not_started_chapters}</div>
            <p className="text-xs text-muted-foreground">chapters remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Subject Tabs */}
        <Tabs value={activeSubject} onValueChange={setActiveSubject} className="w-full">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All Subjects</TabsTrigger>
              {curriculum.subjects.map((subject) => (
                <TabsTrigger key={subject.id} value={subject.id} className="gap-1.5">
                  {getSubjectIcon(subject.icon)}
                  {subject.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <RiFilterLine className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ChapterStatus | 'all')}
                className="bg-background border rounded-md px-3 py-1.5 text-sm"
              >
                <option value="all">All Status</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Subject Content */}
          <TabsContent value={activeSubject} className="mt-6 space-y-6">
            {filteredSubjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                filteredChapters={filterChapters(subject.chapters)}
                onUpdateProgress={handleUpdateProgress}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onUpdateNotes={handleUpdateNotes}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Subject Card Component
function SubjectCard({
  subject,
  filteredChapters,
  onUpdateProgress,
  onAddTag,
  onRemoveTag,
  onUpdateNotes,
}: {
  subject: SubjectWithProgress;
  filteredChapters: ChapterWithProgress[];
  onUpdateProgress: (chapterId: string, status: ChapterStatus) => void;
  onAddTag: (chapterId: string, tag: SystemTag) => void;
  onRemoveTag: (chapterId: string, tag: string) => void;
  onUpdateNotes: (chapterId: string, notes: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
            >
              {getSubjectIcon(subject.icon)}
            </div>
            <div>
              <CardTitle className="text-lg">{subject.name}</CardTitle>
              <CardDescription>
                {subject.completed_chapters}/{subject.total_chapters} chapters completed
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{subject.overall_progress_percent}%</div>
            <p className="text-xs text-muted-foreground">
              ~{subject.completed_hours.toFixed(1)}/{subject.total_estimated_hours}h
            </p>
          </div>
        </div>
        <Progress value={subject.overall_progress_percent} className="mt-3" />

        {/* Tags Summary */}
        {(subject.chapters_need_revision > 0 ||
          subject.chapters_important > 0 ||
          subject.chapters_difficult > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {subject.chapters_need_revision > 0 && (
              <Badge variant="outline" className={TAG_COLORS.need_revision}>
                {subject.chapters_need_revision} need revision
              </Badge>
            )}
            {subject.chapters_important > 0 && (
              <Badge variant="outline" className={TAG_COLORS.important}>
                {subject.chapters_important} important
              </Badge>
            )}
            {subject.chapters_difficult > 0 && (
              <Badge variant="outline" className={TAG_COLORS.difficult}>
                {subject.chapters_difficult} difficult
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredChapters.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No chapters match the selected filter
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {filteredChapters.map((chapter) => (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                onUpdateProgress={onUpdateProgress}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onUpdateNotes={onUpdateNotes}
              />
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

// Chapter Item Component
function ChapterItem({
  chapter,
  onUpdateProgress,
  onAddTag,
  onRemoveTag,
  onUpdateNotes,
}: {
  chapter: ChapterWithProgress;
  onUpdateProgress: (chapterId: string, status: ChapterStatus) => void;
  onAddTag: (chapterId: string, tag: SystemTag) => void;
  onUpdateNotes: (chapterId: string, notes: string) => void;
  onRemoveTag: (chapterId: string, tag: string) => void;
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(chapter.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const availableTags: SystemTag[] = ['need_revision', 'important', 'difficult', 'easy', 'exam_important'];
  const unusedTags = availableTags.filter((tag) => !chapter.system_tags.includes(tag));

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await onUpdateNotes(chapter.id, notesValue);
    setIsSaving(false);
    setIsEditingNotes(false);
  };

  const handleCancelNotes = () => {
    setNotesValue(chapter.notes || '');
    setIsEditingNotes(false);
  };

  return (
    <AccordionItem value={chapter.id} className="border rounded-lg mb-2 overflow-hidden">
      <AccordionTrigger className="hover:no-underline px-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium shrink-0">
            {chapter.order}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{chapter.name}</span>
              <Badge className={cn('text-xs shrink-0', STATUS_COLORS[chapter.status])}>
                {STATUS_LABELS[chapter.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
              <span>{chapter.topics.length} topics</span>
              <span>{chapter.estimated_hours}h estimated</span>
              <span className="capitalize">{chapter.weightage} weightage</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 hidden md:block">
              <Progress value={chapter.progress_percent} className="h-2" />
            </div>
            <span className="text-sm font-medium w-12 text-right">{chapter.progress_percent}%</span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4">
        <div className="space-y-4 pt-2 pb-2">
          {/* Description */}
          <p className="text-sm text-muted-foreground">{chapter.description}</p>

          {/* Topics */}
          <div>
            <h4 className="text-sm font-medium mb-2">Topics</h4>
            <div className="flex flex-wrap gap-2">
              {chapter.topics.map((topic, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {chapter.system_tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn('text-xs cursor-pointer', TAG_COLORS[tag as SystemTag])}
                  onClick={() => onRemoveTag(chapter.id, tag)}
                >
                  {TAG_LABELS[tag as SystemTag]} &times;
                </Badge>
              ))}
              {chapter.custom_tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs cursor-pointer"
                  onClick={() => onRemoveTag(chapter.id, tag)}
                >
                  {tag} &times;
                </Badge>
              ))}
              {unusedTags.length > 0 && (
                <select
                  className="text-xs bg-background border rounded px-2 py-1"
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddTag(chapter.id, e.target.value as SystemTag);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                >
                  <option value="">+ Add tag</option>
                  {unusedTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {TAG_LABELS[tag]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Notes</h4>
              {!isEditingNotes && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setIsEditingNotes(true)}
                >
                  <RiEditLine className="w-3 h-3 mr-1" />
                  {chapter.notes ? 'Edit' : 'Add notes'}
                </Button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add your notes about this chapter..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <RiLoader4Line className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RiSaveLine className="w-4 h-4 mr-1" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelNotes}
                    disabled={isSaving}
                  >
                    <RiCloseLine className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : chapter.notes ? (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{chapter.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">No notes yet</p>
            )}
          </div>

          {/* Timestamps */}
          {(chapter.started_at || chapter.completed_at || chapter.last_studied_at) && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {chapter.started_at && (
                <span>Started: {new Date(chapter.started_at).toLocaleDateString()}</span>
              )}
              {chapter.completed_at && (
                <span>Completed: {new Date(chapter.completed_at).toLocaleDateString()}</span>
              )}
              {chapter.last_studied_at && (
                <span>Last studied: {new Date(chapter.last_studied_at).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {chapter.status !== 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdateProgress(chapter.id, 'in_progress')}
                disabled={chapter.status === 'in_progress'}
              >
                <RiTimeLine className="w-4 h-4 mr-1" />
                Start Learning
              </Button>
            )}
            {chapter.status !== 'completed' && (
              <Button
                size="sm"
                variant="default"
                onClick={() => onUpdateProgress(chapter.id, 'completed')}
              >
                <RiCheckLine className="w-4 h-4 mr-1" />
                Mark Complete
              </Button>
            )}
            {chapter.status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdateProgress(chapter.id, 'in_progress')}
              >
                <RiEditLine className="w-4 h-4 mr-1" />
                Mark as In Progress
              </Button>
            )}
            {chapter.status !== 'not_started' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateProgress(chapter.id, 'not_started')}
              >
                <RiArrowGoBackLine className="w-4 h-4 mr-1" />
                Mark as Unread
              </Button>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// Loading Skeleton
function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-2 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Skeleton className="h-10 w-full" />

      {[1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
