'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  RiBookOpenLine,
  RiQuestionAnswerLine,
  RiCalendarLine,
  RiBarChartBoxLine,
  RiCheckLine,
} from '@remixicon/react';

const steps = [
  {
    title: 'Welcome to Shiksha AI!',
    description: 'Your personalized AI learning companion for CBSE, ICSE, and State Board students.',
    icon: RiBookOpenLine,
    features: [
      'Get personalized help from AI tutor',
      'Take adaptive quizzes to test your knowledge',
      'Create smart study plans for exams',
      'Track your progress with analytics',
    ],
  },
  {
    title: 'AI Tutor',
    description: 'Ask questions and get instant, personalized explanations.',
    icon: RiQuestionAnswerLine,
    features: [
      'Choose from 4 answer modes: Simple, 2-mark, 5-mark, or Topper',
      'Get NCERT-aligned explanations',
      'Chat history saved automatically',
      'Learn at your own pace',
    ],
  },
  {
    title: 'Smart Quizzes',
    description: 'Test yourself with AI-generated quizzes tailored to your level.',
    icon: RiQuestionAnswerLine,
    features: [
      'Generate quizzes on any topic',
      'Get instant feedback with explanations',
      'Track weak and strong topics',
      'Adaptive difficulty levels',
    ],
  },
  {
    title: 'Study Planner',
    description: 'Create personalized study plans based on your exam dates.',
    icon: RiCalendarLine,
    features: [
      '40-40-20 phase structure for optimal learning',
      'Prioritizes your weak topics',
      'Daily task tracking',
      'Progress visualization',
    ],
  },
  {
    title: 'Ready to Start!',
    description: 'You\'re all set to begin your learning journey with Shiksha AI.',
    icon: RiCheckLine,
    features: [
      'Start chatting with AI tutor',
      'Take your first quiz',
      'Create a study plan',
      'View your analytics dashboard',
    ],
  },
];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { completeOnboarding, user } = useAuth();
  const step = steps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Icon className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">{step.title}</CardTitle>
          <CardDescription className="text-base mt-2">{step.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {currentStep === 0 && (
            <div className="text-center mb-4">
              <p className="text-lg">
                Hi <span className="font-semibold">{user?.name}</span>! 
                Let&apos;s take a quick tour.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {step.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                  <RiCheckLine className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{feature}</p>
              </div>
            ))}
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 justify-center mt-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-8 bg-primary'
                    : index < currentStep
                    ? 'w-4 bg-primary/50'
                    : 'w-4 bg-border'
                }`}
              />
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleSkip}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                Previous
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
