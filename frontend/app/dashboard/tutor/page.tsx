'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { RiMenuLine } from '@remixicon/react';
import { useTutorStore } from '@/lib/store/tutor.store';
import { TutorSidebar, ChatContainer, ChatInput } from '@/components/tutor';

export default function TutorPage() {
  const { sidebarOpen, setSidebarOpen } = useTutorStore();

  // Reset streaming state on unmount
  useEffect(() => {
    return () => {
      useTutorStore.setState({
        isStreaming: false,
        streamingContent: '',
      });
    };
  }, []);

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r bg-muted/30">
        <TutorSidebar />
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="flex items-center gap-2 border-b p-2 lg:hidden shrink-0">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <RiMenuLine className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <TutorSidebar onSessionSelect={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="font-semibold">AI Tutor</h1>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <ChatContainer />
        </div>

        {/* Input Area */}
        <ChatInput />
      </main>
    </div>
  );
}
