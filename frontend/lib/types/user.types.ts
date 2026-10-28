export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  class: number;
  board: string;
  subjects: string[];
  weak_topics: string[];
  strong_topics: string[];
  target_exams?: string[];
  daily_study_hours?: number;
  updated_at: string;
}

export interface UserWithProfile {
  user: User;
  profile: UserProfile;
}

// Onboarding status
export interface OnboardingStatus {
  completed: boolean;
  step: number;
  total_steps: number;
}
