'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RiSparklingLine, RiLoader4Line } from '@remixicon/react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';

interface Chapter {
  id: string;
  name: string;
  order: number;
  estimated_hours: number;
}

interface Subject {
  id: string;
  name: string;
  total_chapters: number;
  chapters: Chapter[];
}

interface UserProfile {
  class: number;
}

interface CurriculumResponse {
  curriculum: {
    class: number;
    board: string;
    subjects: Subject[];
  };
}

interface PlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanCreated: () => void;
}

export function PlanForm({ open, onOpenChange, onPlanCreated }: PlanFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [userClass, setUserClass] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    subject: '',
    chapter_id: '',
    deadline: '',
    daily_study_hours: 2,
  });

  // Fetch user profile and then subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoadingSubjects(true);
      try {
        // First get user profile to know their class
        const profileData = await apiClient.get<{ profile: UserProfile }>('/api/profile');
        const classNum = profileData.profile?.class || 11; // Default to class 11
        setUserClass(classNum);

        // Then fetch curriculum for that class
        const data = await apiClient.get<CurriculumResponse>(`/api/curriculum/${classNum}`);
        if (data.curriculum?.subjects) {
          setSubjects(data.curriculum.subjects);
        }
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
        // Fallback to class 11 curriculum
        try {
          const data = await apiClient.get<CurriculumResponse>('/api/curriculum/11');
          if (data.curriculum?.subjects) {
            setSubjects(data.curriculum.subjects);
          }
        } catch (fallbackError) {
          console.error('Failed to fetch fallback curriculum:', fallbackError);
        }
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    if (open) {
      fetchSubjects();
    }
  }, [open]);

  // Update chapters when subject changes
  useEffect(() => {
    if (!formData.subject) {
      setChapters([]);
      return;
    }

    // Find the subject in our local data
    const selectedSubject = subjects.find((s) => s.name === formData.subject);
    if (selectedSubject?.chapters) {
      setChapters(selectedSubject.chapters);
    } else if (userClass) {
      // Fetch chapters from API if not in local data
      const fetchChapters = async () => {
        setIsLoadingChapters(true);
        try {
          const data = await apiClient.get<{ subject: Subject }>(
            `/api/curriculum/${userClass}/${encodeURIComponent(formData.subject)}`
          );
          setChapters(data.subject?.chapters || []);
        } catch (error) {
          console.error('Failed to fetch chapters:', error);
          setChapters([]);
        } finally {
          setIsLoadingChapters(false);
        }
      };
      fetchChapters();
    }
  }, [formData.subject, subjects, userClass]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || !formData.chapter_id || !formData.deadline) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate deadline is in the future
    const deadline = new Date(formData.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deadline <= today) {
      toast.error('Deadline must be in the future');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/api/planner/generate-topic-plan', {
        subject: formData.subject,
        chapter_id: formData.chapter_id,
        deadline: new Date(formData.deadline).toISOString(),
        daily_study_hours: formData.daily_study_hours,
        include_quiz: true,
      });

      toast.success('Study plan created successfully!');
      onOpenChange(false);
      onPlanCreated();

      // Reset form
      setFormData({
        subject: '',
        chapter_id: '',
        deadline: '',
        daily_study_hours: 2,
      });
    } catch (error) {
      console.error('Failed to create plan:', error);
      // Error toast is handled by apiClient
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate min date (tomorrow)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  // Get selected chapter info
  const selectedChapter = chapters.find((c) => c.id === formData.chapter_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Study Plan</DialogTitle>
          <DialogDescription>
            Generate a topic-wise study plan with AI assistance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Select
              value={formData.subject}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, subject: value, chapter_id: '' }))
              }
              disabled={isLoadingSubjects}
            >
              <SelectTrigger id="subject">
                <SelectValue placeholder={isLoadingSubjects ? 'Loading...' : 'Select a subject'} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chapter */}
          <div className="space-y-2">
            <Label htmlFor="chapter">Chapter *</Label>
            <Select
              value={formData.chapter_id}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, chapter_id: value }))
              }
              disabled={!formData.subject || isLoadingChapters}
            >
              <SelectTrigger id="chapter">
                <SelectValue
                  placeholder={
                    isLoadingChapters
                      ? 'Loading chapters...'
                      : !formData.subject
                        ? 'Select a subject first'
                        : 'Select a chapter'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    {chapter.order}. {chapter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedChapter && (
              <p className="text-xs text-muted-foreground">
                Estimated time: {selectedChapter.estimated_hours} hours
              </p>
            )}
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline *</Label>
            <input
              type="date"
              id="deadline"
              min={minDateStr}
              value={formData.deadline}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, deadline: e.target.value }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Daily Study Hours */}
          <div className="space-y-2">
            <Label htmlFor="hours">Daily Study Hours</Label>
            <Select
              value={formData.daily_study_hours.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  daily_study_hours: parseFloat(value),
                }))
              }
            >
              <SelectTrigger id="hours">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">30 minutes</SelectItem>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="1.5">1.5 hours</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="2.5">2.5 hours</SelectItem>
                <SelectItem value="3">3 hours</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="5">5 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isLoadingSubjects}>
              {isLoading ? (
                <>
                  <RiLoader4Line className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RiSparklingLine className="w-4 h-4 mr-2" />
                  Generate Plan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
