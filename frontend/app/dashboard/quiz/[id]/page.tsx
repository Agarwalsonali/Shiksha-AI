'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  RiCheckLine, 
  RiCloseLine, 
  RiLoader4Line, 
  RiArrowLeftLine,
  RiRefreshLine,
  RiTrophyLine,
  RiBookLine,
  RiTimeLine
} from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/ui/markdown';

interface Question {
  question: string;
  options: Record<string, string>;
  difficulty?: string;
  topic?: string;
}

interface QuizData {
  quiz: {
    id: string;
    subject: string;
    chapter: string;
    topic: string;
    difficulty: string;
    total_questions: number;
  };
  questions: Question[];
  latest_attempt?: {
    id: string;
    score_percent: number;
    correct_answers: number;
    total_questions: number;
    time_taken_seconds: number;
    results: Array<{
      question: string;
      is_correct: boolean;
      selected_answer: string;
      correct_answer: string;
      explanation?: string;
    }>;
    completed_at: string;
  };
}

export default function QuizAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    attempt: {
      score_percent: number;
      correct_answers: number;
      total_questions: number;
      time_taken_seconds: number;
    };
    results: Array<{
      question: string;
      is_correct: boolean;
      selected_answer: string;
      correct_answer: string;
      explanation?: string;
    }>;
  } | null>(null);

  const fetchQuiz = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/${quizId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch quiz');

      const data = await response.json();
      setQuizData(data.data);
      
      // If quiz has been completed, show results directly
      if (data.data.latest_attempt) {
        setResults({
          attempt: {
            score_percent: data.data.latest_attempt.score_percent,
            correct_answers: data.data.latest_attempt.correct_answers,
            total_questions: data.data.latest_attempt.total_questions,
            time_taken_seconds: data.data.latest_attempt.time_taken_seconds,
          },
          results: data.data.latest_attempt.results,
        });
        setShowResults(true);
      } else {
        // Reset state for fresh quiz
        setAnswers({});
        setCurrentQuestion(0);
        setStartTime(Date.now());
        setShowResults(false);
        setResults(null);
      }
    } catch (error) {
      console.error('Error fetching quiz:', error);
      toast.error('Failed to load quiz');
      router.push('/dashboard/quiz');
    } finally {
      setIsLoading(false);
    }
  }, [quizId, router]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleRetryQuiz = () => {
    // Reset all state for a fresh attempt (don't refetch, just reset UI state)
    setAnswers({});
    setCurrentQuestion(0);
    setStartTime(Date.now());
    setShowResults(false);
    setResults(null);
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== quizData?.questions.length) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const formattedAnswers = Object.entries(answers).map(([index, answer]) => ({
        question_index: parseInt(index),
        selected_answer: answer as 'A' | 'B' | 'C' | 'D',
      }));

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          quiz_id: quizId,
          answers: formattedAnswers,
          time_taken_seconds: timeTaken,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit quiz');

      const data = await response.json();
      setResults(data.data);
      setShowResults(true);
      toast.success(`Quiz completed! Score: ${data.data.attempt.score_percent.toFixed(0)}%`);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quizData) return null;

  // Results view with improved UI
  if (showResults && results) {
    const scorePercent = results.attempt.score_percent;
    const isPassing = scorePercent >= 60;
    const isExcellent = scorePercent >= 90;

    return (
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Score Card */}
        <Card className={cn(
          "border-2",
          isExcellent ? "border-green-500 bg-green-500/5" : 
          isPassing ? "border-primary bg-primary/5" : 
          "border-orange-500 bg-orange-500/5"
        )}>
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              {/* Trophy Icon */}
              <div className={cn(
                "mx-auto w-20 h-20 rounded-full flex items-center justify-center",
                isExcellent ? "bg-green-500/20" : 
                isPassing ? "bg-primary/20" : 
                "bg-orange-500/20"
              )}>
                <RiTrophyLine className={cn(
                  "h-10 w-10",
                  isExcellent ? "text-green-500" : 
                  isPassing ? "text-primary" : 
                  "text-orange-500"
                )} />
              </div>

              {/* Score */}
              <div>
                <div className={cn(
                  "text-6xl font-bold",
                  isExcellent ? "text-green-500" : 
                  isPassing ? "text-primary" : 
                  "text-orange-500"
                )}>
                  {scorePercent.toFixed(0)}%
                </div>
                <p className="text-lg text-muted-foreground mt-1">
                  {isExcellent ? "Excellent!" : isPassing ? "Good job!" : "Keep practicing!"}
                </p>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold">
                    {results.attempt.correct_answers}/{results.attempt.total_questions}
                  </div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold flex items-center justify-center gap-1">
                    <RiTimeLine className="h-5 w-5" />
                    {Math.floor(results.attempt.time_taken_seconds / 60)}:{(results.attempt.time_taken_seconds % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-sm text-muted-foreground">Time</p>
                </div>
              </div>

              {/* Quiz Info */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge variant="outline">
                  <RiBookLine className="h-3 w-3 mr-1" />
                  {quizData.quiz.subject}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {quizData.quiz.difficulty}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question Review</CardTitle>
            <CardDescription>
              {quizData.quiz.chapter}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.results.map((result, index) => (
              <div 
                key={index} 
                className={cn(
                  "rounded-lg border p-4",
                  result.is_correct 
                    ? "border-green-500/50 bg-green-500/5" 
                    : "border-red-500/50 bg-red-500/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                    result.is_correct 
                      ? "bg-green-500 text-white" 
                      : "bg-red-500 text-white"
                  )}>
                    {result.is_correct ? <RiCheckLine className="h-4 w-4" /> : <RiCloseLine className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-sm">
                      <span className="mr-1">Q{index + 1}.</span>
                      <Markdown content={result.question} className="inline [&_p]:inline [&_p]:my-0" />
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground">Your answer:</span>
                        <Badge variant={result.is_correct ? "default" : "destructive"} className="font-normal">
                          {result.selected_answer}
                        </Badge>
                      </p>
                      {!result.is_correct && (
                        <p className="flex items-center gap-2">
                          <span className="text-muted-foreground">Correct answer:</span>
                          <Badge variant="default" className="font-normal bg-green-600">
                            {result.correct_answer}
                          </Badge>
                        </p>
                      )}
                      {result.explanation && (
                        <div className="mt-2 border-l-2 border-muted pl-2">
                          <Markdown 
                            content={result.explanation} 
                            className="text-xs text-muted-foreground [&_p]:my-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={() => router.push('/dashboard/quiz')} 
            variant="outline"
            className="flex-1"
          >
            <RiArrowLeftLine className="mr-2 h-4 w-4" />
            Back to Quizzes
          </Button>
          <Button 
            onClick={handleRetryQuiz}
            className="flex-1"
          >
            <RiRefreshLine className="mr-2 h-4 w-4" />
            Retry Quiz
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / quizData.questions.length) * 100;
  const currentQ = quizData.questions[currentQuestion];

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{quizData.quiz.subject}</h1>
            <p className="text-muted-foreground">{quizData.quiz.chapter}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              Question {currentQuestion + 1} of {quizData.questions.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(answers).length} answered
            </p>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question Card */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="text-lg leading-relaxed flex-1">
              <Markdown content={currentQ.question} className="[&_p]:my-0" />
            </div>
            {currentQ.difficulty && (
              <Badge variant="outline" className="capitalize shrink-0">
                {currentQ.difficulty}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Use key prop to force re-render RadioGroup when question changes */}
          <RadioGroup
            key={`question-${currentQuestion}`}
            value={answers[currentQuestion] || ''}
            onValueChange={(value) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion]: value }))
            }
            className="space-y-3"
          >
            {Object.entries(currentQ.options).map(([key, option]) => (
              <div 
                key={key} 
                className={cn(
                  "flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors w-full",
                  answers[currentQuestion] === key 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-muted/50"
                )}
                onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion]: key }))}
              >
                <RadioGroupItem value={key} id={`q${currentQuestion}-option-${key}`} className="mt-0.5 shrink-0" />
                <Label 
                  htmlFor={`q${currentQuestion}-option-${key}`} 
                  className="flex-1 cursor-pointer text-sm leading-relaxed"
                >
                  <span className="font-semibold mr-2">{key}.</span>
                  <Markdown content={option} className="inline [&_p]:inline [&_p]:my-0" />
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>

            {currentQuestion === quizData.questions.length - 1 ? (
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || Object.keys(answers).length !== quizData.questions.length}
              >
                {isSubmitting ? (
                  <>
                    <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Quiz'
                )}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  setCurrentQuestion((prev) =>
                    Math.min(quizData.questions.length - 1, prev + 1)
                  )
                }
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Navigator */}
      <Card className="w-full">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {quizData.questions.map((_, index) => (
              <Button
                key={index}
                variant={currentQuestion === index ? "default" : answers[index] ? "secondary" : "outline"}
                size="sm"
                className="w-9 h-9 p-0"
                onClick={() => setCurrentQuestion(index)}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
