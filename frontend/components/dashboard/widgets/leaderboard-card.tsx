'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RiMedalLine, RiArrowRightLine, RiVipCrownLine } from '@remixicon/react';
import { leaderboardApi } from '@/lib/api/leaderboard.api';
import { useAuth } from '@/lib/hooks/use-auth';
import type { LeaderboardEntry, UserRank } from '@/lib/types/leaderboard.types';
import { cn } from '@/lib/utils';

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
const MEDAL_BGS = ['bg-yellow-500/10', 'bg-gray-400/10', 'bg-amber-600/10'];

interface LeaderboardCardProps {
  compact?: boolean;
}

export function LeaderboardCard({ compact = false }: LeaderboardCardProps) {
  const { profile } = useAuth();
  const [topPerformers, setTopPerformers] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<UserRank | null>(null);
  const [loading, setLoading] = useState(true);

  const userClass = profile?.class || 11;

  useEffect(() => {
    fetchLeaderboardData();
  }, [userClass]);

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      // Fetch sequentially to avoid rate limiting
      const performersRes = await leaderboardApi.getTopPerformers(userClass, 5).catch(() => null);
      const rank = await leaderboardApi.getMyRank().catch(() => null);
      
      // Backend returns { top_performers: [...] }
      const performers = (performersRes as any)?.top_performers || [];
      setTopPerformers(performers);
      setMyRank(rank);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
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

  if (loading) {
    return <LeaderboardCardSkeleton compact={compact} />;
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Your Rank</CardTitle>
          <RiMedalLine className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {myRank?.rank ? `#${myRank.rank}` : 'Unranked'}
          </div>
          {myRank && (
            <p className="text-xs text-muted-foreground mt-1">
              Top {myRank.percentile}% of {myRank.total_users} students
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RiMedalLine className="h-5 w-5 text-yellow-500" />
            Top Performers
          </CardTitle>
          <CardDescription>Class {userClass} leaderboard</CardDescription>
        </div>
        <Link href="/dashboard/leaderboard">
          <Button variant="ghost" size="sm">
            View All
            <RiArrowRightLine className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* My Rank */}
        {myRank && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {myRank.rank || '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">Your Rank</p>
                <p className="text-xs text-muted-foreground">
                  Top {myRank.percentile}% • Score: {myRank.score.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Performers List */}
        {topPerformers.length > 0 ? (
          <div className="space-y-2">
            {topPerformers.map((entry, idx) => (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg',
                  idx < 3 ? MEDAL_BGS[idx] : 'hover:bg-muted/50'
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    idx < 3 ? MEDAL_COLORS[idx] : 'text-muted-foreground'
                  )}
                >
                  {idx === 0 ? (
                    <RiVipCrownLine className="w-4 h-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(entry.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.quiz_avg}% avg • {entry.streak} streak
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{entry.score.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <RiMedalLine className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">
              No leaderboard data yet
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function LeaderboardCardSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-32 mt-1" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-28 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
