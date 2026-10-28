'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RiUserLine,
  RiLockLine,
  RiNotificationLine,
  RiPaletteLine,
  RiSaveLine,
  RiLoader4Line,
  RiCheckLine,
  RiSunLine,
  RiMoonLine,
  RiComputerLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTheme } from 'next-themes';

const BOARDS = ['CBSE', 'ICSE', 'State Board'];

const SUBJECTS = [
  'Mathematics',
  'Science',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Hindi',
  'Social Science',
  'History',
  'Geography',
  'Computer Science',
  'Economics',
  'Political Science',
];

interface ProfileData {
  name: string;
  email: string;
  class: number;
  board: string;
  subjects: string[];
  daily_study_hours: number;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    class: 6,
    board: 'CBSE',
    subjects: [],
    daily_study_hours: 2,
  });

  useEffect(() => {
    setMounted(true);
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile/full`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const userData = result.data;
        const userProfile = userData.user_profile;
        
        setProfileData({
          name: userData.name || '',
          email: userData.email || '',
          class: userProfile?.class || 6,
          board: userProfile?.board || 'CBSE',
          subjects: userProfile?.subjects || [],
          daily_study_hours: userProfile?.daily_study_hours || 2,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (profileData.subjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          class: profileData.class,
          board: profileData.board,
          subjects: profileData.subjects,
          daily_study_hours: profileData.daily_study_hours,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update profile');
      }

      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSubject = (subject: string) => {
    setProfileData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiUserLine className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal details and academic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">Contact support to change your name</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    disabled
                    className="opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">Contact support to change your email</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="class">Class</Label>
                  <Select
                    value={profileData.class.toString()}
                    onValueChange={(value) =>
                      setProfileData({ ...profileData, class: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="class">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 7, 8, 9, 10, 11, 12].map((cls) => (
                        <SelectItem key={cls} value={cls.toString()}>
                          Class {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="board">Board</Label>
                  <Select
                    value={profileData.board}
                    onValueChange={(value) => setProfileData({ ...profileData, board: value })}
                  >
                    <SelectTrigger id="board">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARDS.map((board) => (
                        <SelectItem key={board} value={board}>
                          {board}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily_study_hours">Daily Study Hours</Label>
                <Select
                  value={profileData.daily_study_hours.toString()}
                  onValueChange={(value) =>
                    setProfileData({ ...profileData, daily_study_hours: parseFloat(value) })
                  }
                >
                  <SelectTrigger id="daily_study_hours">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6].map((hours) => (
                      <SelectItem key={hours} value={hours.toString()}>
                        {hours} {hours === 1 ? 'hour' : 'hours'} per day
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Subjects</Label>
                <p className="text-sm text-muted-foreground">
                  Select the subjects you're currently studying
                </p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {SUBJECTS.map((subject) => (
                    <div key={subject} className="flex items-center space-x-2">
                      <Checkbox
                        id={subject}
                        checked={profileData.subjects.includes(subject)}
                        onCheckedChange={() => toggleSubject(subject)}
                      />
                      <label
                        htmlFor={subject}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {subject}
                      </label>
                    </div>
                  ))}
                </div>
                {profileData.subjects.length === 0 && (
                  <p className="text-sm text-destructive">Please select at least one subject</p>
                )}
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <RiLoader4Line className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <RiSaveLine className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiLockLine className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Password</p>
                    <p className="text-sm text-muted-foreground">Last changed 30 days ago</p>
                  </div>
                  <Button variant="outline" disabled>
                    Change Password
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Password management coming soon. Contact support if you need to reset your password.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiNotificationLine className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Configure your notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="study-reminders">Study Reminders</Label>
                  <p className="text-xs text-muted-foreground">Get daily study reminders</p>
                </div>
                <Checkbox id="study-reminders" disabled />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="quiz-alerts">Quiz Alerts</Label>
                  <p className="text-xs text-muted-foreground">Alerts for new quizzes</p>
                </div>
                <Checkbox id="quiz-alerts" disabled />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="progress-updates">Progress Updates</Label>
                  <p className="text-xs text-muted-foreground">Weekly progress reports</p>
                </div>
                <Checkbox id="progress-updates" disabled />
              </div>
              <p className="text-xs text-muted-foreground">
                Notification preferences coming soon
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiPaletteLine className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize how Shiksha AI looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={mounted && theme === 'light' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setTheme('light')}
                  >
                    <RiSunLine className="h-5 w-5" />
                    <span className="text-xs">Light</span>
                  </Button>
                  <Button
                    variant={mounted && theme === 'dark' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setTheme('dark')}
                  >
                    <RiMoonLine className="h-5 w-5" />
                    <span className="text-xs">Dark</span>
                  </Button>
                  <Button
                    variant={mounted && theme === 'system' ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-2 h-auto py-3"
                    onClick={() => setTheme('system')}
                  >
                    <RiComputerLine className="h-5 w-5" />
                    <span className="text-xs">System</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred color scheme
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
