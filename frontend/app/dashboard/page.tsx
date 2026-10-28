'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  RiFireLine,
  RiCalendarCheckLine,
  RiTrophyLine,
  RiTimeLine,
  RiArrowRightLine,
} from '@remixicon/react';
import { ProgressSummaryCard, LeaderboardCard } from '@/components/dashboard/widgets';
import { statsApi, type OverviewStats, type StreakStats, type TopicStat } from '@/lib/api/stats.api';
import { plannerApi } from '@/lib/api/planner.api';
import type { PlanTask } from '@/lib/types/planner.types';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [streaks, setStreaks] = useState<StreakStats | null>(null);
  const [todayTasks, setTodayTasks] = useState<PlanTask[]>([]);
  const [weakTopics, setWeakTopics] = useState<TopicStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch stats sequentially to avoid rate limiting
      const overviewRes = await statsApi.getOverview(30).catch(() => null);
      const streaksRes = await statsApi.getStreaks().catch(() => null);
      const tasksRes = await plannerApi.getTodayTasks().catch(() => ({ tasks: [] }));
      const topicsRes = await statsApi.getTopicStats(undefined, 5).catch(() => null);

      if (overviewRes?.overview) setOverview(overviewRes.overview);
      if (streaksRes?.streaks) setStreaks(streaksRes.streaks);
      if (tasksRes?.tasks) setTodayTasks(tasksRes.tasks);
      if (topicsRes?.topics) {
        // Filter topics with score < 70% as weak
        setWeakTopics(topicsRes.topics.filter(t => t.avg_score < 70));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      name: 'Study Streak',
      value: streaks ? `${streaks.current_streak} days` : '0 days',
      icon: RiFireLine,
      color: 'text-orange-500',
    },
    {
      name: 'Tasks Completed',
      value: overview ? `${overview.tasks_completed}` : '0',
      icon: RiCalendarCheckLine,
      color: 'text-green-500',
    },
    {
      name: 'Quiz Score',
      value: overview && overview.total_quizzes > 0 ? `${overview.avg_quiz_score}%` : 'N/A',
      icon: RiTrophyLine,
      color: 'text-yellow-500',
    },
    {
      name: 'Study Time',
      value: overview ? `${overview.total_study_hours}h` : '0h',
      icon: RiTimeLine,
      color: 'text-blue-500',
    },
  ];

  const completedTodayTasks = todayTasks.filter((t) => t.status === 'completed').length;
  const totalTodayTasks = todayTasks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0] || 'Student'}!</h1>
        <p className="text-muted-foreground">Here's your learning progress overview</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Progress Summary */}
          <ProgressSummaryCard />

          {/* Today's Study Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Study Plan</CardTitle>
              <CardDescription>
                {totalTodayTasks > 0
                  ? `${completedTodayTasks}/${totalTodayTasks} tasks completed`
                  : 'Your tasks for today'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : todayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks scheduled for today</p>
              ) : (
                <div className="space-y-2">
                  {todayTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border ${
                        task.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/50'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          task.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground'
                        }`}
                      />
                      <span
                        className={`text-sm flex-1 ${
                          task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {task.topic || task.chapter || task.subject}
                      </span>
                      {task.duration_min && (
                        <span className="text-xs text-muted-foreground">{task.duration_min}m</span>
                      )}
                    </div>
                  ))}
                  {todayTasks.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{todayTasks.length - 5} more tasks
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Leaderboard Card */}
          <LeaderboardCard />

          {/* Weak Topics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Topics to Improve</CardTitle>
                <CardDescription>Based on quiz performance</CardDescription>
              </div>
              <Link href="/dashboard/quiz">
                <Button variant="ghost" size="sm">
                  Practice
                  <RiArrowRightLine className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-32 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              ) : weakTopics.length > 0 ? (
                <div className="space-y-2">
                  {weakTopics.map((topic, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 border border-red-500/10"
                    >
                      <span className="text-sm font-medium">{topic.topic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {topic.attempts} quiz{topic.attempts !== 1 ? 'zes' : ''}
                        </span>
                        <span className="text-xs font-medium text-red-500">
                          {topic.avg_score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : profile?.weak_topics && profile.weak_topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.weak_topics.slice(0, 5).map((topic, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-sm"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Take quizzes to identify topics that need practice
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Strong Topics - Only show if user has some */}
      {profile?.strong_topics && profile.strong_topics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Strong Topics</CardTitle>
            <CardDescription>Topics where you&apos;re doing well</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.strong_topics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm"
                >
                  {topic}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
