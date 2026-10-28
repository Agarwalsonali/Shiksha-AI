'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  RiCalendarLine,
  RiTimeLine,
  RiLoader4Line,
  RiAddLine,
  RiDeleteBinLine,
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from '@remixicon/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Planner components
import {
  StreakCounter,
  PlannerCalendar,
  CalendarLegend,
  PlanForm,
  TopicTaskRow,
  QuizSuggestionModal,
} from '@/components/planner';

// API and types
import { plannerApi } from '@/lib/api/planner.api';
import type {
  StreakData,
  PlanWithProgress,
  PlanTask,
  TaskStatus,
  UpdateTaskResponse,
} from '@/lib/types/planner.types';

export default function PlannerPage() {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Data states
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [plansBySubject, setPlansBySubject] = useState<Record<string, PlanWithProgress[]>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeSubject, setActiveSubject] = useState<string>('all');

  // Tasks for selected plan/date
  const [selectedPlanTasks, setSelectedPlanTasks] = useState<PlanTask[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // UI states
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [completedChapter, setCompletedChapter] = useState<{
    name: string;
    id: string;
    subject: string;
  } | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [streakRes, plansRes] = await Promise.all([
        plannerApi.getStreak(),
        plannerApi.getAllPlans(),
      ]);

      setStreakData(streakRes.streak);
      setPlansBySubject(plansRes.plans_by_subject);
      setSubjects(plansRes.subjects);
    } catch (error) {
      console.error('Failed to fetch planner data:', error);
      toast.error('Failed to load planner data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch tasks when plan is selected
  const fetchPlanTasks = useCallback(async (planId: string) => {
    setIsLoadingTasks(true);
    try {
      const response = await plannerApi.getChapterPlan(planId);
      setSelectedPlanTasks(response.tasks);
      setSelectedPlanId(planId);
    } catch (error) {
      console.error('Failed to fetch plan tasks:', error);
      setSelectedPlanTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  // Handle task status change
  const handleTaskStatusChange = async (taskId: string, status: TaskStatus) => {
    // Optimistic update
    setSelectedPlanTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status, completed_at: status === 'completed' ? new Date().toISOString() : null }
          : task
      )
    );

    try {
      const response: UpdateTaskResponse = await plannerApi.updateTopicTask(taskId, { status });

      // Check if chapter was completed
      if (response.chapter_completed && response.suggest_quiz) {
        setCompletedChapter({
          name: response.chapter_name || 'Chapter',
          id: response.chapter_id || '',
          subject: response.subject,
        });
        setShowQuizModal(true);
        fetchAllData();
      }

      // Update streak if task completed
      if (status === 'completed') {
        const streakRes = await plannerApi.getStreak();
        setStreakData(streakRes.streak);
      }
    } catch (error) {
      // Revert on error
      if (selectedPlanId) {
        fetchPlanTasks(selectedPlanId);
      }
      console.error('Failed to update task:', error);
    }
  };

  // Handle plan deletion
  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      await plannerApi.deletePlan(planId);
      toast.success('Plan deleted');
      fetchAllData();
      if (selectedPlanId === planId) {
        setSelectedPlanId(null);
        setSelectedPlanTasks([]);
      }
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  };

  // Get filtered plans based on active subject
  const getFilteredPlans = (): PlanWithProgress[] => {
    if (activeSubject === 'all') {
      return Object.values(plansBySubject).flat();
    }
    return plansBySubject[activeSubject] || [];
  };

  // Get task dates for calendar (scheduled tasks)
  const getTaskDates = (): string[] => {
    const dates = new Set<string>();
    const allPlans = Object.values(plansBySubject).flat();

    allPlans.forEach((plan) => {
      if (plan.deadline) {
        dates.add(plan.deadline.split('T')[0]);
      }
    });

    return Array.from(dates);
  };

  // Calculate subject task counts
  const getSubjectCounts = (subject: string): number => {
    const plans = plansBySubject[subject] || [];
    return plans.reduce((sum, plan) => sum + (plan.progress.total_tasks - plan.progress.completed_tasks), 0);
  };

  const getAllPendingCount = (): number => {
    return Object.values(plansBySubject)
      .flat()
      .reduce((sum, plan) => sum + (plan.progress.total_tasks - plan.progress.completed_tasks), 0);
  };

  if (isLoading) {
    return <PlannerSkeleton />;
  }

  const filteredPlans = getFilteredPlans();
  const hasPlans = Object.keys(plansBySubject).length > 0;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Planner</h1>
          <p className="text-sm text-muted-foreground">Plan and track your study goals</p>
        </div>
        <div className="flex items-center gap-2">
          {streakData && (
            <StreakCounter
              currentStreak={streakData.current_streak}
              longestStreak={streakData.longest_streak}
            />
          )}
          <Button size="sm" onClick={() => setShowPlanForm(true)}>
            <RiAddLine className="w-4 h-4 mr-1" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Main Content - Plans Left (3/4), Calendar Right (1/4) */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Plans Section - Left 3/4 */}
        <div className="flex-1 lg:w-3/4 space-y-4 min-w-0">
          {!hasPlans ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <RiCalendarLine className="mb-3 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-1 text-base font-semibold">No Study Plans Yet</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground max-w-sm">
                  Create a topic-wise study plan to break down chapters into daily tasks.
                </p>
                <Button size="sm" onClick={() => setShowPlanForm(true)}>
                  <RiAddLine className="w-4 h-4 mr-1" />
                  Create Your First Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={activeSubject} onValueChange={setActiveSubject}>
              <TabsList className="h-auto flex-wrap gap-1">
                <TabsTrigger value="all" className="flex-none">
                  All
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {getAllPendingCount()}
                  </Badge>
                </TabsTrigger>
                {subjects.map((subject) => (
                  <TabsTrigger key={subject} value={subject} className="flex-none">
                    {subject}
                    <Badge variant="secondary" className="ml-1.5 text-xs">
                      {getSubjectCounts(subject)}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeSubject} className="mt-4 space-y-3">
                {filteredPlans.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No plans for this subject yet
                    </CardContent>
                  </Card>
                ) : (
                  filteredPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isExpanded={selectedPlanId === plan.id}
                      tasks={selectedPlanId === plan.id ? selectedPlanTasks : []}
                      isLoadingTasks={isLoadingTasks && selectedPlanId === plan.id}
                      onToggle={() => {
                        if (selectedPlanId === plan.id) {
                          setSelectedPlanId(null);
                          setSelectedPlanTasks([]);
                        } else {
                          fetchPlanTasks(plan.id);
                        }
                      }}
                      onDelete={() => handleDeletePlan(plan.id)}
                      onTaskStatusChange={handleTaskStatusChange}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Calendar Section - Right 1/4 */}
        <div className="lg:w-1/4 lg:min-w-[280px]">
          <Card className="sticky top-6">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Study Calendar</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <PlannerCalendar
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                studyDates={streakData?.study_dates || []}
                taskDates={getTaskDates()}
              />
              <CalendarLegend />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <PlanForm
        open={showPlanForm}
        onOpenChange={setShowPlanForm}
        onPlanCreated={fetchAllData}
      />

      {completedChapter && (
        <QuizSuggestionModal
          open={showQuizModal}
          onOpenChange={setShowQuizModal}
          chapterName={completedChapter.name}
          chapterId={completedChapter.id}
          subject={completedChapter.subject}
        />
      )}
    </div>
  );
}

// Plan Card Component with Collapsible
function PlanCard({
  plan,
  isExpanded,
  tasks,
  isLoadingTasks,
  onToggle,
  onDelete,
  onTaskStatusChange,
}: {
  plan: PlanWithProgress;
  isExpanded: boolean;
  tasks: PlanTask[];
  isLoadingTasks: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
}) {
  const isOverdue = plan.status === 'overdue';
  const isCompleted = plan.status === 'completed';
  const chapterName = (plan.plan_meta as { chapter_name?: string })?.chapter_name || 'Chapter';
  const deadlineDate = plan.deadline ? new Date(plan.deadline) : null;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn(
        'overflow-hidden',
        isOverdue && 'border-red-500/50',
        isCompleted && 'opacity-70'
      )}>
        {/* Header - Always visible */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <CollapsibleTrigger asChild>
              <div className="flex-1 min-w-0 cursor-pointer">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{chapterName}</span>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                      <RiAlertLine className="w-3 h-3 mr-0.5" />
                      Overdue
                    </Badge>
                  )}
                  {isCompleted && (
                    <Badge className="text-xs px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                      Done
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{plan.subject}</span>
                  {deadlineDate && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <RiTimeLine className="w-3 h-3" />
                        {deadlineDate.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="text-base font-semibold">{plan.progress.completion_percent}%</div>
                <p className="text-xs text-muted-foreground">
                  {plan.progress.completed_tasks}/{plan.progress.total_tasks}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <RiDeleteBinLine className="w-4 h-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isExpanded ? (
                    <RiArrowUpSLine className="w-4 h-4" />
                  ) : (
                    <RiArrowDownSLine className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={plan.progress.completion_percent} className="h-1 mt-3" />
        </div>

        {/* Expandable Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0">
            {isLoadingTasks ? (
              <div className="flex items-center justify-center py-4">
                <RiLoader4Line className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tasks found</p>
            ) : (
              <div className="border rounded-lg overflow-hidden divide-y">
                {tasks.map((task) => (
                  <TopicTaskRow
                    key={task.id}
                    task={task}
                    onStatusChange={onTaskStatusChange}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Loading Skeleton
function PlannerSkeleton() {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Plans Section */}
        <div className="flex-1 lg:w-3/4 space-y-4">
          {/* Tabs */}
          <Skeleton className="h-9 w-64" />

          {/* Plan cards */}
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="h-1 w-full mt-3" />
              </div>
            </Card>
          ))}
        </div>

        {/* Calendar */}
        <div className="lg:w-1/4 lg:min-w-[280px]">
          <Card>
            <CardHeader className="py-3 px-4">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
