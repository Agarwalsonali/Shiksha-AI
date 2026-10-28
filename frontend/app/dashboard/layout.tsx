'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { useAuth } from '@/lib/hooks/use-auth';
import { Onboarding } from '@/components/shared/onboarding';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { showOnboarding } = useAuth();

  return (
    <AuthGuard>
      {showOnboarding ? (
        <Onboarding />
      ) : (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <DashboardHeader />
            <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      )}
    </AuthGuard>
  );
}
