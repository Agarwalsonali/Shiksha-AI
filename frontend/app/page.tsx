'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/theme-toggle';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Github,
  GraduationCap,
  ListChecks,
  MessageSquare,
  Quote,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#curriculum', label: 'Curriculum' },
];

const FEATURES = [
  {
    icon: ListChecks,
    title: 'Adaptive quizzes',
    body: 'Multiple-choice practice generated per chapter, with easy, medium and hard sets that feed straight back into your weak-topic list.',
  },
  {
    icon: CalendarDays,
    title: 'Study planner',
    body: 'Give it a deadline. It returns a day-by-day plan for the chapter, quiz day included, sized to the hours you actually have.',
  },
  {
    icon: TrendingUp,
    title: 'Progress analytics',
    body: 'Accuracy per subject and topic, quiz history, and streaks — so revision targets the chapters that are really costing you marks.',
  },
  {
    icon: Trophy,
    title: 'XP & leaderboard',
    body: 'Every quiz, plan and streak earns XP. Climb the board, keep the streak alive, and make the boring part feel like a game.',
  },
];

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
    <div className="relative min-h-screen overflow-x-clip bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" aria-hidden="true">
        <div className="landing-grid absolute inset-0" />
        <div className="landing-glow absolute left-1/2 top-[-260px] h-[620px] w-[820px] -translate-x-1/2 opacity-60" />
      </div>

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mt-3 flex items-center justify-between gap-2 rounded-full border border-border/70 bg-background/70 py-1.5 pl-3 pr-1.5 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:mt-4 sm:pl-4">
            <Link href="/" className="group flex items-center gap-2" aria-label="Shiksha AI home">
              <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
                <GraduationCap className="size-4" />
              </span>
              <span className="text-sm font-medium tracking-tight">Shiksha AI</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <Link
                href="https://github.com/Agarwalsonali/Shiksha-AI"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
              >
                <Button variant="ghost" size="icon-sm" tabIndex={-1}>
                  <Github className="size-4" />
                </Button>
              </Link>
              <ModeToggle />
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="rounded-full pr-3">
                  Sign up
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-14 pb-16 pt-28 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-10 lg:pb-24 lg:pt-40">
          <div className="landing-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5" />
              Grounded in your NCERT textbooks
            </span>

            <h1 className="mt-6 text-balance text-4xl font-medium leading-[1.06] tracking-[-0.03em] sm:text-5xl lg:text-[3.25rem]">
              The AI tutor that{' '}
              <span className="text-muted-foreground">knows your syllabus.</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
              Ask anything from your own chapters and get step-by-step answers with real math and
              chemistry notation. Then lock it in with adaptive quizzes and a study plan built
              around your deadline.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup">
                <Button size="lg" className="h-11 rounded-full px-5 text-sm">
                  Start learning free
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="outline" className="h-11 rounded-full px-5 text-sm">
                  See how it works
                </Button>
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {['CBSE, ICSE & state boards', 'Classes 9–12', 'No credit card'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-3.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview */}
          <div className="landing-rise relative mx-auto w-full max-w-lg lg:mx-0 [animation-delay:120ms]">
            <div
              className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-b from-foreground/[0.07] via-transparent to-transparent blur-2xl"
              aria-hidden="true"
            />

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-muted">
                    <MessageSquare className="size-3.5" />
                  </span>
                  <span className="text-xs font-medium">AI Tutor</span>
                </div>
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  Class 9 · Mathematics
                </span>
              </div>

              <div className="space-y-3 p-4 text-sm">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-foreground px-3.5 py-2 text-background">
                  Why is √2 irrational? Show me the proof.
                </div>

                <div className="max-w-[92%] space-y-2.5 rounded-2xl rounded-bl-sm border border-border/70 bg-background/60 px-3.5 py-3">
                  <p className="text-muted-foreground">Assume the opposite — that √2 is rational:</p>
                  <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center font-serif text-[13px] italic">
                    √2 = p / q, with p and q coprime
                  </p>
                  <p className="text-muted-foreground">
                    Squaring gives <span className="font-medium text-foreground">p² = 2q²</span>, so p²
                    is even — which makes p even too. Write p = 2k, then q² = 2k², so q is even as
                    well. But p and q cannot both be even, so √2 must be irrational.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                    <BookOpen className="size-3" />
                    NCERT Class 9 · Number Systems
                  </div>
                </div>
              </div>

              <div className="border-t border-border/70 bg-background/40 p-4">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Practice · hard</span>
                  <span>Q 3 of 10</span>
                </div>
                <p className="mt-2 text-xs leading-snug">Which of these is an irrational number?</p>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {[
                    { text: '0.25', correct: false },
                    { text: '√16', correct: false },
                    { text: '√7', correct: true },
                    { text: '22/7', correct: false },
                  ].map((option) => (
                    <div
                      key={option.text}
                      className={
                        option.correct
                          ? 'flex items-center justify-between rounded-md border border-foreground/30 bg-foreground/[0.07] px-2.5 py-1.5 text-xs font-medium'
                          : 'flex items-center justify-between rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground'
                      }
                    >
                      {option.text}
                      {option.correct && <Check className="size-3" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating metric chips */}
            <div className="absolute -bottom-9 right-4 flex gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] shadow-lg">
                <Sparkles className="size-3" />
                92% quiz accuracy
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] shadow-lg">
                <Trophy className="size-3" />
                12-day streak
              </span>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section id="curriculum" className="scroll-mt-24 border-y border-border/70 py-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { value: '341', label: 'chapters mapped to class 9–12' },
              { value: '3', label: 'board patterns supported' },
              { value: '6', label: 'subjects from tutor to planner' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-3">
                <span className="text-2xl font-medium tracking-tight">{stat.value}</span>
                <span className="text-xs leading-snug text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Everything in one place</p>
            <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
              Not a chatbot bolted onto a textbook.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Every answer comes from your chapter, every quiz knows what you got wrong last time, and
              every plan starts from the hours you have left.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            <article className="group rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-foreground/25 sm:p-7">
              <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-10">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/60 transition-transform group-hover:-translate-y-0.5">
                      <MessageSquare className="size-4" />
                    </span>
                    <h3 className="font-medium">AI Tutor, grounded in your chapter</h3>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Retrieval pulls the right passage from your textbook before the model answers, so
                    explanations follow your syllabus instead of a generic one. Math renders as real
                    notation, chemistry as balanced equations, and every answer cites the chapter it
                    came from.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {['Gemini', 'Weaviate vector search', 'Supabase', 'Next.js'].map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
                  {[
                    { icon: Sparkles, text: 'Step-by-step reasoning, not just the final answer' },
                    { icon: BookOpen, text: 'LaTeX for maths, balanced equations for chemistry' },
                    { icon: Check, text: 'Chapter citations you can check yourself' },
                    { icon: MessageSquare, text: 'Follow-up questions keep the thread in context' },
                  ].map((row) => (
                    <div key={row.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <row.icon className="size-3.5 shrink-0" />
                      {row.text}
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="group flex flex-col rounded-2xl border border-border/70 bg-card p-6 transition-colors hover:border-foreground/25"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-muted/60 transition-transform group-hover:-translate-y-0.5">
                    <feature.icon className="size-4" />
                  </span>
                  <h3 className="mt-4 font-medium">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 border-t border-border/70 py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">How it works</p>
              <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight sm:text-4xl">
                Set up once. Then just study.
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Three steps, no configuration. Your class, board and subjects shape everything the
                tutor, quizzes and planner produce.
              </p>

              <div className="mt-8 rounded-2xl border border-border/70 bg-card p-5">
                <Quote className="size-4 text-muted-foreground" />
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  The difference is that it asks me about my class first. The answers actually match
                  the chapter I am being tested on.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">— a class 10 CBSE student</p>
              </div>
            </div>

            <ol className="relative space-y-2">
              {[
                {
                  title: 'Tell us your class and board',
                  body: 'Choose your class, board and subjects. Chapters load from the NCERT map, so nothing you see is generic.',
                },
                {
                  title: 'Ask, practise, plan',
                  body: 'The tutor answers from your chapters, quizzes adapt to what you miss, and the planner turns a deadline into daily tasks.',
                },
                {
                  title: 'Close the gaps',
                  body: 'Progress and weak-topic tracking show exactly where the next hour should go. XP and streaks keep it going.',
                },
              ].map((step, index) => (
                <li
                  key={step.title}
                  className="group flex gap-4 rounded-2xl border border-transparent p-4 transition-colors hover:border-border/70 hover:bg-card/60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20">
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-14 text-center sm:px-12">
            <div className="landing-grid absolute inset-0 opacity-70" aria-hidden="true" />
            <div className="landing-glow absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 opacity-50" aria-hidden="true" />

            <div className="relative">
              <h2 className="mx-auto max-w-xl text-balance text-3xl font-medium tracking-tight sm:text-4xl">
                Your next study session could be the one that clicks.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
                Free to use, set up in under a minute, and built around the syllabus you are already
                being examined on.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/signup">
                  <Button size="lg" className="h-11 rounded-full px-5 text-sm">
                    Create free account
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="h-11 rounded-full px-5 text-sm">
                    I already have one
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/70 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
                <GraduationCap className="size-3.5" />
              </span>
              <span className="text-sm font-medium">Shiksha AI</span>
            </div>
            <nav className="flex items-center gap-5 text-xs text-muted-foreground" aria-label="Footer">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#how-it-works" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <Link href="/login" className="transition-colors hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="transition-colors hover:text-foreground">
                Sign up
              </Link>
            </nav>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Shiksha AI</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
