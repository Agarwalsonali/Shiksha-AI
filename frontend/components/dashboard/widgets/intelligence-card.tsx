'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RiBrainLine, RiSparklingLine, RiBarChartLine } from '@remixicon/react';
import { intelligenceApi } from '@/lib/api/intelligence.api';
import type { IQLevel, KnowledgeLevel } from '@/lib/types/intelligence.types';
import { getIQCategory, IQ_CATEGORIES, BLOOM_LEVELS } from '@/lib/types/intelligence.types';
import { cn } from '@/lib/utils';

interface IntelligenceCardProps {
  compact?: boolean;
}

export function IntelligenceCard({ compact = false }: IntelligenceCardProps) {
  const [iqLevel, setIqLevel] = useState<IQLevel | null>(null);
  const [knowledgeLevels, setKnowledgeLevels] = useState<KnowledgeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIntelligenceData();
  }, []);

  const fetchIntelligenceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [iq, knowledge] = await Promise.all([
        intelligenceApi.getIQLevel().catch(() => null),
        intelligenceApi.getKnowledgeLevels().catch(() => []),
      ]);
      setIqLevel(iq);
      setKnowledgeLevels(knowledge);
    } catch (err) {
      setError('Failed to load intelligence data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <IntelligenceCardSkeleton compact={compact} />;
  }

  // Check if iqLevel exists and has valid iq_score
  const hasValidIQ = iqLevel && typeof iqLevel.iq_score === 'number' && !isNaN(iqLevel.iq_score);

  if (error || !hasValidIQ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RiBrainLine className="h-5 w-5 text-purple-500" />
            Cognitive Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <RiSparklingLine className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {error || 'Start learning to build your cognitive profile'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const iqScore = iqLevel.iq_score ?? 100; // Default to 100 if somehow null
  const category = getIQCategory(iqScore);
  const categoryInfo = IQ_CATEGORIES[category];

  // Calculate cognitive dimensions average - ensure values are numbers
  const safeNum = (val: number | null | undefined) => (typeof val === 'number' && !isNaN(val) ? val : 0);
  
  const dimensions = [
    { name: 'Logical Reasoning', value: safeNum(iqLevel.logical_reasoning), icon: '🧮' },
    { name: 'Problem Solving', value: safeNum(iqLevel.problem_solving), icon: '🔧' },
    { name: 'Conceptual Understanding', value: safeNum(iqLevel.conceptual_understanding), icon: '💡' },
    { name: 'Analytical Thinking', value: safeNum(iqLevel.analytical_thinking), icon: '🔬' },
    { name: 'Memory Retention', value: safeNum(iqLevel.memory_retention), icon: '🧠' },
  ];

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">IQ Score</CardTitle>
          <RiBrainLine className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(iqScore)}</div>
          <Badge
            className="mt-1"
            style={{ backgroundColor: `${categoryInfo.color}20`, color: categoryInfo.color }}
          >
            {categoryInfo.label}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {iqLevel.evaluation_count ?? 0} evaluations
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RiBrainLine className="h-5 w-5 text-purple-500" />
          Cognitive Profile
        </CardTitle>
        <CardDescription>Your learning intelligence based on AI evaluation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* IQ Score Display */}
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex flex-col items-center justify-center"
            style={{ backgroundColor: `${categoryInfo.color}15` }}
          >
            <span className="text-3xl font-bold" style={{ color: categoryInfo.color }}>
              {Math.round(iqScore)}
            </span>
            <span className="text-xs text-muted-foreground">IQ</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge style={{ backgroundColor: `${categoryInfo.color}20`, color: categoryInfo.color }}>
                {categoryInfo.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {safeNum(iqLevel.confidence)}% confidence
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Based on {iqLevel.evaluation_count ?? 0} evaluations from quizzes and tutor sessions
            </p>
          </div>
        </div>

        {/* Cognitive Dimensions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Cognitive Dimensions</h4>
          {dimensions.map((dim) => (
            <div key={dim.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <span>{dim.icon}</span>
                  {dim.name}
                </span>
                <span className="text-muted-foreground">{dim.value}%</span>
              </div>
              <Progress value={dim.value} className="h-2" />
            </div>
          ))}
        </div>

        {/* Knowledge Levels by Subject */}
        {knowledgeLevels.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Subject Knowledge</h4>
            <div className="grid gap-2">
              {knowledgeLevels.slice(0, 3).map((kl) => (
                <div
                  key={kl.subject}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <span className="text-sm font-medium">{kl.subject}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={safeNum(kl.knowledge_score)} className="w-20 h-2" />
                    <span className="text-sm text-muted-foreground w-10">
                      {safeNum(kl.knowledge_score)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function IntelligenceCardSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-5 w-20 mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
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
