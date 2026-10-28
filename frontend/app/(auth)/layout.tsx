import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/theme-toggle';
import { RiGithubFill } from '@remixicon/react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between rounded-full border bg-background/80 px-4 py-2 backdrop-blur-sm">
            <Link href="/" className="text-sm font-medium">
              Shiksha AI
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="https://github.com/idityaGE/shiksha-ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <RiGithubFill className="h-4 w-4" />
                </Button>
              </Link>
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
