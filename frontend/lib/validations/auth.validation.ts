import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  class: z.number().int().min(9).max(12, 'Class must be between 9 and 12'),
  board: z.string().min(1, 'Please select your board'),
  subjects: z.array(z.string()).min(1, 'Please select at least one subject'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// Constants for dropdowns
export const CLASS_LEVELS = [
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' },
];

export const BOARDS = [
  { value: 'CBSE', label: 'CBSE' },
  { value: 'ICSE', label: 'ICSE' },
  { value: 'State Board', label: 'State Board' },
];

// Subjects available per class based on actual curriculum data
export const SUBJECTS_BY_CLASS: Record<number, { value: string; label: string }[]> = {
  9: [
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'Science', label: 'Science' },
    { value: 'Social Science', label: 'Social Science' },
    { value: 'English', label: 'English' },
    { value: 'Hindi', label: 'Hindi' },
  ],
  10: [
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'Science', label: 'Science' },
    { value: 'Social Science', label: 'Social Science' },
    { value: 'English', label: 'English' },
    { value: 'Hindi', label: 'Hindi' },
  ],
  11: [
    { value: 'Physics', label: 'Physics' },
    { value: 'Chemistry', label: 'Chemistry' },
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'Biology', label: 'Biology' },
    { value: 'English', label: 'English' },
  ],
  12: [
    { value: 'Physics', label: 'Physics' },
    { value: 'Chemistry', label: 'Chemistry' },
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'Biology', label: 'Biology' },
    { value: 'English', label: 'English' },
  ],
};

// Fallback flat list (shown before a class is selected)
export const SUBJECTS = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Science', label: 'Science' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Biology', label: 'Biology' },
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Social Science', label: 'Social Science' },
];
