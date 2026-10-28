'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  signupSchema,
  type SignupInput,
  CLASS_LEVELS,
  BOARDS,
  SUBJECTS,
} from '@/lib/validations/auth.validation';
import Link from 'next/link';
import { RiLoader4Line, RiMailLine } from '@remixicon/react';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export function SignupForm() {
  const router = useRouter();
  const { signup, isLoading } = useAuth();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      subjects: [],
    },
  });

  const handleSubjectToggle = (subject: string) => {
    const updated = selectedSubjects.includes(subject)
      ? selectedSubjects.filter((s) => s !== subject)
      : [...selectedSubjects, subject];
    setSelectedSubjects(updated);
    setValue('subjects', updated);
  };

  const onSubmit = async (data: SignupInput) => {
    try {
      setUserEmail(data.email);
      await signup(data);
      setShowVerificationMessage(true);
    } catch (error) {
      console.error('Signup failed:', error);
    }
  };

  if (showVerificationMessage) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <RiMailLine className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-medium mb-2">Check your email</h2>
        <p className="text-sm text-muted-foreground mb-6">
          We sent a verification link to <span className="font-medium text-foreground">{userEmail}</span>
        </p>
        <div className="space-y-3">
          <Button className="w-full" onClick={() => router.push('/login')}>
            Continue to Sign in
          </Button>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Your name"
            disabled={isLoading}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            disabled={isLoading}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password"
            disabled={isLoading}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="class">Class</Label>
            <Select
              disabled={isLoading}
              onValueChange={(value) => setValue('class', parseInt(value))}
            >
              <SelectTrigger id="class">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.class && (
              <p className="text-sm text-destructive">{errors.class.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="board">Board</Label>
            <Select disabled={isLoading} onValueChange={(value) => setValue('board', value)}>
              <SelectTrigger id="board">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {BOARDS.map((board) => (
                  <SelectItem key={board.value} value={board.value}>
                    {board.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.board && (
              <p className="text-sm text-destructive">{errors.board.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Subjects</Label>
          <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl max-h-32 overflow-y-auto">
            {SUBJECTS.map((subject) => (
              <div key={subject.value} className="flex items-center space-x-2">
                <Checkbox
                  id={subject.value}
                  checked={selectedSubjects.includes(subject.value)}
                  onCheckedChange={() => handleSubjectToggle(subject.value)}
                  disabled={isLoading}
                />
                <label
                  htmlFor={subject.value}
                  className="text-sm leading-none cursor-pointer"
                >
                  {subject.label}
                </label>
              </div>
            ))}
          </div>
          {errors.subjects && (
            <p className="text-sm text-destructive">{errors.subjects.message}</p>
          )}
        </div>
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      
      <p className="text-sm text-center text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
