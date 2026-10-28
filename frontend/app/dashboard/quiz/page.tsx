'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  RiQuestionLine, 
  RiLoader4Line, 
  RiSparklingLine, 
  RiCheckLine, 
  RiTimeLine,
  RiPlayCircleLine 
} from '@remixicon/react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/hooks/use-auth';

interface Chapter {
  id: string;
  order: number;
  name: string;
}

interface Quiz {
  id: string;
  subject: string;
  chapter: string;
  topic: string | null;
  difficulty: string;
  total_questions: number; // Backend returns total_questions, not num_questions
  created_at: string;
  latest_attempt?: {
    score: number;
    total_questions: number;
    percentage: number;
    completed_at: string;
  };
}

export default function QuizPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [quizHistory, setQuizHistory] = useState<Quiz[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [formData, setFormData] = useState({
    subject: '',
    chapter: '',
    topic: '',
    difficulty: 'medium',
    num_questions: 5,
  });

  // Get subjects from user profile or use defaults
  const userSubjects = profile?.subjects || [
    'Mathematics',
    'Science',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
  ];
  // Only use valid classes (9-12), default to 11 if invalid or not set
  const userClass = profile?.class && [9, 10, 11, 12].includes(profile.class) 
    ? profile.class 
    : 11;

  useEffect(() => {
    fetchQuizHistory();
  }, []);

  // Fetch chapters when subject changes (only if we have a valid class)
  useEffect(() => {
    if (formData.subject && userClass) {
      fetchChapters(formData.subject);
    } else {
      setChapters([]);
    }
  }, [formData.subject, userClass]);

  const fetchChapters = async (subject: string) => {
    setIsLoadingChapters(true);
    setChapters([]);
    setFormData(prev => ({ ...prev, chapter: '', topic: '' }));
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/curriculum/${userClass}/${encodeURIComponent(subject)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setChapters(data.data.subject?.chapters || []);
      } else {
        console.error('Failed to fetch chapters');
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  // Handle chapter change
  const handleChapterChange = (chapterName: string) => {
    setFormData(prev => ({ ...prev, chapter: chapterName, topic: '' }));
  };

  const fetchQuizHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/quiz/list?limit=10`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQuizHistory(data.data.quizzes || []);
      }
    } catch (error) {
      console.error('Error fetching quiz history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!formData.subject || !formData.chapter) {
      toast.error('Please fill in subject and chapter');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate quiz');
      }

      const data = await response.json();
      toast.success('Quiz generated successfully!');
      
      // Refresh quiz history
      await fetchQuizHistory();
      
      // Navigate to quiz attempt page
      router.push(`/dashboard/quiz/${data.data.quiz.id}`);
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      toast.error(error.message || 'Failed to generate quiz');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quiz</h1>
        <p className="text-muted-foreground">Generate AI-powered quizzes to test your knowledge</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Generate Quiz Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiSparklingLine className="h-5 w-5 text-primary" />
              Generate New Quiz
            </CardTitle>
            <CardDescription>Create a personalized quiz on any topic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select
                value={formData.subject}
                onValueChange={(value) => setFormData({ ...formData, subject: value })}
              >
                <SelectTrigger id="subject" className="w-full">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {userSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chapter">Chapter</Label>
              <Select
                value={formData.chapter}
                onValueChange={handleChapterChange}
                disabled={!formData.subject || isLoadingChapters}
              >
                <SelectTrigger id="chapter" className="w-full">
                  {isLoadingChapters ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <RiLoader4Line className="h-4 w-4 animate-spin" />
                      Loading chapters...
                    </span>
                  ) : (
                    <SelectValue placeholder={formData.subject ? "Select chapter" : "Select subject first"} />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.name}>
                      {chapter.order}. {chapter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic">Topic (Optional)</Label>
              <Input
                id="topic"
                placeholder="e.g., Speed and Velocity"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value: any) => setFormData({ ...formData, difficulty: value })}
              >
                <SelectTrigger id="difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="num_questions">Questions</Label>
              <Select
                value={formData.num_questions.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, num_questions: parseInt(value) })
                }
              >
                <SelectTrigger id="num_questions" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RiSparklingLine className="mr-2 h-4 w-4" />
                  Generate Quiz
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Quizzes Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiQuestionLine className="h-5 w-5" />
              Recent Quizzes
            </CardTitle>
            <CardDescription>Your quiz history</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : quizHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RiQuestionLine className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No quizzes yet</p>
                <p className="text-sm text-muted-foreground/70">Generate your first quiz to get started!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {quizHistory.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/quiz/${quiz.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">{quiz.subject}</h4>
                        <Badge variant="outline" className="capitalize text-xs shrink-0">
                          {quiz.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {quiz.chapter}
                        {quiz.topic && ` • ${quiz.topic}`}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <RiQuestionLine className="h-3 w-3" />
                          {quiz.total_questions} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <RiTimeLine className="h-3 w-3" />
                          {formatDistanceToNow(new Date(quiz.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {quiz.latest_attempt ? (
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {quiz.latest_attempt.percentage.toFixed(0)}%
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {quiz.latest_attempt.score}/{quiz.latest_attempt.total_questions}
                          </p>
                        </div>
                        <RiCheckLine className="h-5 w-5 text-green-500" />
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="ml-4 shrink-0">
                        <RiPlayCircleLine className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
