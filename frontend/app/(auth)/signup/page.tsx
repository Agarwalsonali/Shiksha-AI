import { SignupForm } from '@/components/auth/signup-form';

export const metadata = {
  title: 'Sign Up | Shiksha AI',
  description: 'Create your Shiksha AI account',
};

export default function SignupPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your learning journey
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
