'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  RiMedalLine,
  RiTrophyLine,
  RiFireLine,
  RiVipCrownLine,
  RiStarLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiSparklingLine,
  RiTimeLine,
  RiCalendarLine,
} from '@remixicon/react';
import { leaderboardApi } from '@/lib/api/leaderboard.api';
import { useAuth } from '@/lib/hooks/use-auth';
import type {
  LeaderboardEntry,
  PeriodLeaderboardEntry,
  SubjectLeaderboardEntry,
  UserRank,
  LeaderboardType,
} from '@/lib/types/leaderboard.types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Medal colors for top 3
const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
const MEDAL_BGS = ['bg-yellow-500/10', 'bg-gray-400/10', 'bg-amber-600/10'];

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('overall');
  const [overallData, setOverallData] = useState<LeaderboardEntry[]>([]);
  const [weeklyData, setWeeklyData] = useState<{
    entries: PeriodLeaderboardEntry[];
    period_start: string;
    period_end: string;
  } | null>(null);
  const [monthlyData, setMonthlyData] = useState<{
    entries: PeriodLeaderboardEntry[];
    period_start: string;
    period_end: string;
  } | null>(null);
  const [subjectData, setSubjectData] = useState<SubjectLeaderboardEntry[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [myRank, setMyRank] = useState<UserRank | null>(null);
  const [loading, setLoading] = useState(true);

  const userClass = profile?.class || 11;
  const userSubjects = profile?.subjects || [];

  useEffect(() => {
    if (userSubjects.length > 0 && !selectedSubject) {
      setSelectedSubject(userSubjects[0]);
    }
  }, [userSubjects, selectedSubject]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [activeTab, selectedSubject, userClass]);

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);

      // Always fetch user's rank
      const rankPromise = leaderboardApi.getMyRank();

      let dataPromise;
      switch (activeTab) {
        case 'overall':
          dataPromise = leaderboardApi.getClassLeaderboard(userClass, 50);
          break;
        case 'weekly':
          dataPromise = leaderboardApi.getWeeklyLeaderboard(userClass, 50);
          break;
        case 'monthly':
          dataPromise = leaderboardApi.getMonthlyLeaderboard(userClass, 50);
          break;
        case 'subject':
          if (selectedSubject) {
            dataPromise = leaderboardApi.getSubjectLeaderboard(userClass, selectedSubject, 50);
          }
          break;
      }

      const [rankResult, dataResult] = await Promise.all([
        rankPromise.catch(() => null),
        dataPromise,
      ]);

      if (rankResult) {
        setMyRank(rankResult);
      }

      if (dataResult) {
        switch (activeTab) {
          case 'overall':
            setOverallData((dataResult as any).leaderboard || []);
            break;
          case 'weekly':
            setWeeklyData({
              entries: (dataResult as any).leaderboard || [],
              period_start: (dataResult as any).period_start || '',
              period_end: (dataResult as any).period_end || '',
            });
            break;
          case 'monthly':
            setMonthlyData({
              entries: (dataResult as any).leaderboard || [],
              period_start: (dataResult as any).period_start || '',
              period_end: (dataResult as any).period_end || '',
            });
            break;
          case 'subject':
            setSubjectData((dataResult as any).leaderboard || []);
            break;
        }
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">
            See how you rank against other students in Class {userClass}
          </p>
        </div>
      </div>

      {/* My Rank Card */}
      {myRank && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <RiMedalLine className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Rank</p>
                  <p className="text-4xl font-bold">
                    {myRank.rank ? `#${myRank.rank}` : 'Unranked'}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">
                  Out of {myRank.total_users} students
                </p>
                <p className="text-2xl font-semibold text-primary">
                  Top {myRank.percentile}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Score: {myRank.score.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaderboardType)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="overall">
              <RiTrophyLine className="w-4 h-4 mr-1" />
              Overall
            </TabsTrigger>
            <TabsTrigger value="weekly">
              <RiTimeLine className="w-4 h-4 mr-1" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <RiCalendarLine className="w-4 h-4 mr-1" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="subject">
              <RiStarLine className="w-4 h-4 mr-1" />
              By Subject
            </TabsTrigger>
          </TabsList>

          {/* Subject Selector */}
          {activeTab === 'subject' && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background border rounded-md px-3 py-1.5 text-sm"
            >
              {userSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Overall Leaderboard */}
        <TabsContent value="overall" className="mt-6">
          {loading ? (
            <LeaderboardSkeleton />
          ) : (
            <OverallLeaderboard entries={overallData} getInitials={getInitials} />
          )}
        </TabsContent>

        {/* Weekly Leaderboard */}
        <TabsContent value="weekly" className="mt-6">
          {loading ? (
            <LeaderboardSkeleton />
          ) : weeklyData && weeklyData.entries ? (
            <PeriodLeaderboard
              entries={weeklyData.entries}
              periodStart={weeklyData.period_start || ''}
              periodEnd={weeklyData.period_end || ''}
              periodType="Week"
              getInitials={getInitials}
            />
          ) : (
            <EmptyLeaderboard message="No weekly data available" />
          )}
        </TabsContent>

        {/* Monthly Leaderboard */}
        <TabsContent value="monthly" className="mt-6">
          {loading ? (
            <LeaderboardSkeleton />
          ) : monthlyData && monthlyData.entries ? (
            <PeriodLeaderboard
              entries={monthlyData.entries}
              periodStart={monthlyData.period_start || ''}
              periodEnd={monthlyData.period_end || ''}
              periodType="Month"
              getInitials={getInitials}
            />
          ) : (
            <EmptyLeaderboard message="No monthly data available" />
          )}
        </TabsContent>

        {/* Subject Leaderboard */}
        <TabsContent value="subject" className="mt-6">
          {loading ? (
            <LeaderboardSkeleton />
          ) : (
            <SubjectLeaderboard
              entries={subjectData}
              subject={selectedSubject}
              getInitials={getInitials}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Overall Leaderboard Component
function OverallLeaderboard({
  entries,
  getInitials,
}: {
  entries: LeaderboardEntry[];
  getInitials: (name: string) => string;
}) {
  if (!entries || entries.length === 0) {
    return <EmptyLeaderboard message="No students on the leaderboard yet" />;
  }

  // Top 3 podium
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6">
      {/* Top 3 Podium */}
      <div className="grid gap-4 md:grid-cols-3">
        {topThree.map((entry, idx) => (
          <Card
            key={entry.user_id}
            className={cn(
              'relative overflow-hidden',
              idx === 0 && 'md:order-2 md:scale-105',
              idx === 1 && 'md:order-1',
              idx === 2 && 'md:order-3'
            )}
          >
            <div className={cn('absolute top-0 left-0 right-0 h-1', MEDAL_BGS[idx])} />
            <CardContent className="pt-6 text-center">
              <div className="relative inline-block">
                <Avatar className="w-16 h-16 mx-auto">
                  <AvatarFallback className={cn('text-lg', MEDAL_BGS[idx])}>
                    {getInitials(entry.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center',
                    MEDAL_BGS[idx]
                  )}
                >
                  {idx === 0 ? (
                    <RiVipCrownLine className={cn('w-4 h-4', MEDAL_COLORS[idx])} />
                  ) : (
                    <span className={cn('text-sm font-bold', MEDAL_COLORS[idx])}>{idx + 1}</span>
                  )}
                </div>
              </div>
              <h3 className="mt-3 font-semibold">{entry.display_name}</h3>
              <p className="text-2xl font-bold mt-1">{entry.score.toFixed(1)}</p>
              <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <RiFireLine className="w-3 h-3 text-orange-500" />
                  {entry.streak}
                </span>
                <span>{entry.quiz_avg}% avg</span>
                <span>{entry.badges_count} badges</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rest of the leaderboard */}
      {rest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rest.map((entry) => (
                <LeaderboardRow
                  key={entry.user_id}
                  rank={entry.rank}
                  name={entry.display_name}
                  score={entry.score}
                  stats={[
                    { label: 'Progress', value: `${entry.progress_percent}%` },
                    { label: 'Quiz Avg', value: `${entry.quiz_avg}%` },
                    { label: 'Streak', value: entry.streak.toString() },
                    { label: 'XP', value: entry.total_xp.toLocaleString() },
                  ]}
                  getInitials={getInitials}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Period Leaderboard Component (Weekly/Monthly)
function PeriodLeaderboard({
  entries,
  periodStart,
  periodEnd,
  periodType,
  getInitials,
}: {
  entries: PeriodLeaderboardEntry[];
  periodStart: string;
  periodEnd: string;
  periodType: string;
  getInitials: (name: string) => string;
}) {
  if (!entries || entries.length === 0) {
    return <EmptyLeaderboard message={`No activity this ${periodType.toLowerCase()} yet`} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RiCalendarLine className="w-4 h-4" />
        <span>
          {new Date(periodStart).toLocaleDateString()} - {new Date(periodEnd).toLocaleDateString()}
        </span>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.user_id}
                rank={entry.rank}
                name={entry.display_name}
                score={entry.score}
                highlight={entry.rank <= 3}
                stats={[
                  { label: 'Quizzes', value: entry.quiz_count.toString() },
                  { label: 'Quiz Avg', value: `${entry.quiz_avg}%` },
                  { label: 'Perfect', value: entry.perfect_quizzes.toString() },
                  { label: 'Chapters', value: entry.chapters_completed.toString() },
                  { label: 'XP Earned', value: entry.total_xp_earned.toLocaleString() },
                ]}
                getInitials={getInitials}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Subject Leaderboard Component
function SubjectLeaderboard({
  entries,
  subject,
  getInitials,
}: {
  entries: SubjectLeaderboardEntry[];
  subject: string;
  getInitials: (name: string) => string;
}) {
  if (!entries || entries.length === 0) {
    return <EmptyLeaderboard message={`No rankings for ${subject} yet`} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{subject} Rankings</CardTitle>
        <CardDescription>Based on quiz performance and chapter completion</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map((entry) => (
            <LeaderboardRow
              key={entry.user_id}
              rank={entry.rank}
              name={entry.display_name}
              score={entry.score}
              highlight={entry.rank <= 3}
              stats={[
                { label: 'Quiz Avg', value: `${entry.quiz_avg}%` },
                { label: 'Quizzes', value: entry.quiz_count.toString() },
                {
                  label: 'Chapters',
                  value: `${entry.chapters_completed}/${entry.chapters_total}`,
                },
                { label: 'Progress', value: `${entry.progress_percent}%` },
              ]}
              getInitials={getInitials}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Leaderboard Row Component
function LeaderboardRow({
  rank,
  name,
  score,
  stats,
  highlight,
  getInitials,
}: {
  rank: number;
  name: string;
  score: number;
  stats: Array<{ label: string; value: string }>;
  highlight?: boolean;
  getInitials: (name: string) => string;
}) {
  const isTop3 = rank <= 3;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg transition-colors',
        highlight || isTop3 ? MEDAL_BGS[rank - 1] || 'bg-muted/50' : 'hover:bg-muted/50'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
          isTop3 ? MEDAL_COLORS[rank - 1] : 'text-muted-foreground'
        )}
      >
        {isTop3 ? (
          rank === 1 ? (
            <RiVipCrownLine className="w-5 h-5" />
          ) : (
            rank
          )
        ) : (
          rank
        )}
      </div>

      <Avatar className="w-10 h-10">
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {stats.map((stat, idx) => (
            <span key={idx}>
              {stat.label}: <span className="font-medium text-foreground">{stat.value}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="text-right">
        <p className="text-lg font-bold">{score.toFixed(1)}</p>
        <p className="text-xs text-muted-foreground">score</p>
      </div>
    </div>
  );
}

// Empty State
function EmptyLeaderboard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <RiTrophyLine className="w-12 h-12 mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Start learning to appear on the leaderboard!
        </p>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function LeaderboardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
