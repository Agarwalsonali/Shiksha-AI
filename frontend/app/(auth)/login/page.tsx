import { LoginForm } from '@/components/auth/login-form';

export const metadata = {
  title: 'Login | Shiksha AI',
  description: 'Login to your Shiksha AI account',
};

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to continue learning
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
