'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/theme-toggle';
import {
  RiRobot2Line,
  RiQuestionnaireLine,
  RiCalendarScheduleLine,
  RiBarChartBoxLine,
  RiTrophyLine,
  RiGithubFill,
  RiArrowRightLine,
} from '@remixicon/react';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between rounded-full border bg-background/80 px-4 py-2 backdrop-blur-sm">
            <span className="text-sm font-medium">Shiksha AI</span>
            <div className="flex items-center gap-1">
              <Link
                href="https://github.com/idityaGE/shiksha-ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <RiGithubFill className="h-4 w-4" />
                </Button>
              </Link>
              <ModeToggle />
              <Link href="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="pt-32 pb-16">
          <div className="max-w-2xl">
            <p className="text-sm text-muted-foreground">For Indian Students</p>
            <h1 className="mt-3 text-4xl font-medium tracking-tight">
              Study smarter with an AI tutor that knows your syllabus
            </h1>
            <p className="mt-4 text-muted-foreground">
              Personalized tutoring, adaptive quizzes, and study planning.
              Supporting CBSE, ICSE, and state boards.
            </p>
            <div className="mt-8 flex gap-3">
              <Link href="/signup">
                <Button className="gap-2">
                  Get started
                  <RiArrowRightLine className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline">How it works</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Bento Grid */}
        <section className="pb-16">
          <div className="grid gap-3 md:grid-cols-3 md:grid-rows-2">
            {/* Large card - AI Tutor */}
            <div className="md:col-span-2 md:row-span-2 rounded-2xl border bg-card p-6">
              <div className="flex h-full flex-col">
                <div className="rounded-xl bg-muted/50 p-4 w-fit mb-4">
                  <RiRobot2Line className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium">AI Tutor</h3>
                <p className="mt-2 text-sm text-muted-foreground flex-1">
                  Ask questions in natural language. Get explanations with LaTeX math rendering, 
                  chemical equations, and step-by-step solutions. Context retrieved directly 
                  from your textbooks using RAG.
                </p>
                <div className="mt-4 pt-4 border-t">
                  <code className="text-xs text-muted-foreground">
                    GPT-5 + Weaviate Vector DB + BM25 Search
                  </code>
                </div>
              </div>
            </div>

            {/* Quiz card */}
            <div className="rounded-2xl border bg-card p-6">
              <div className="rounded-xl bg-muted/50 p-3 w-fit mb-3">
                <RiQuestionnaireLine className="h-5 w-5" />
              </div>
              <h3 className="font-medium">Adaptive Quizzes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                AI-generated MCQs with three difficulty levels. Tracks weak topics automatically.
              </p>
            </div>

            {/* Planner card */}
            <div className="rounded-2xl border bg-card p-6">
              <div className="rounded-xl bg-muted/50 p-3 w-fit mb-3">
                <RiCalendarScheduleLine className="h-5 w-5" />
              </div>
              <h3 className="font-medium">Study Planner</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Set deadlines. Get a day-by-day study plan generated for your chapters.
              </p>
            </div>
          </div>

          {/* Second row */}
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            {/* Progress card */}
            <div className="rounded-2xl border bg-card p-6 flex gap-4">
              <div className="rounded-xl bg-muted/50 p-3 h-fit">
                <RiBarChartBoxLine className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">Progress Tracking</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visual analytics on topic performance. Identifies weak areas for focused revision.
                </p>
              </div>
            </div>

            {/* Gamification card */}
            <div className="rounded-2xl border bg-card p-6 flex gap-4">
              <div className="rounded-xl bg-muted/50 p-3 h-fit">
                <RiTrophyLine className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">Leaderboard</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Earn XP, maintain streaks, unlock badges. Compete with other students.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section id="how-it-works" className="py-16 border-t">
          <div className="mb-8">
            <p className="text-sm text-muted-foreground">Architecture</p>
            <h2 className="mt-1 text-2xl font-medium">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-lg">
              Queries are routed through an agentic system. Complex questions trigger 
              RAG retrieval from textbook embeddings. Simple queries go directly to the LLM.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-3">
            <Image
              src="/images/diagram.jpeg"
              alt="System architecture diagram"
              width={900}
              height={600}
              className="rounded-xl w-full"
            />
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-16 border-t">
          <p className="text-sm text-muted-foreground">Built with</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              'Next.js 16',
              'React 19',
              'TypeScript',
              'Tailwind CSS',
              'shadcn/ui',
              'Bun',
              'Express 5',
              'Supabase',
              'Weaviate',
              'OpenAI GPT-5',
              'Vercel AI SDK',
            ].map((tech) => (
              <span
                key={tech}
                className="rounded-full border px-3 py-1 text-xs"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t">
          <div className="rounded-2xl border bg-card p-8 text-center">
            <h2 className="text-xl font-medium">Start studying</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Free to use. No credit card required.
            </p>
            <div className="mt-6">
              <Link href="/signup">
                <Button>Create account</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Shiksha AI
          </p>
        </footer>
      </main>
    </div>
  );
}
