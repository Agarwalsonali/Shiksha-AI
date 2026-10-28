'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { RiAddLine, RiSearchLine, RiChat1Line } from '@remixicon/react';
import { useTutorStore } from '@/lib/store/tutor.store';
import { SessionItem } from './session-item';

interface TutorSidebarProps {
  onSessionSelect?: () => void;
}

export function TutorSidebar({ onSessionSelect }: TutorSidebarProps) {
  const [search, setSearch] = useState('');
  const {
    sessions,
    sessionsLoading,
    activeSessionId,
    fetchSessions,
    selectSession,
    deleteSession,
    startNewChat,
    setSidebarOpen,
  } = useTutorStore();

  const handleSelectSession = async (sessionId: string) => {
    await selectSession(sessionId);
    onSessionSelect?.();
  };

  const handleNewChat = () => {
    startNewChat();
    onSessionSelect?.();
  };

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Filter sessions by search
  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const query = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title?.toLowerCase().includes(query) ||
        s.detected_subject?.toLowerCase().includes(query)
    );
  }, [sessions, search]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h2 className="font-semibold">Chats</h2>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleNewChat}>
          <RiAddLine className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b shrink-0">
        <div className="relative">
          <RiSearchLine className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Sessions list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {sessionsLoading ? (
            // Loading skeleton
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md p-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <RiChat1Line className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                {search ? 'No matching chats' : 'No chats yet'}
              </p>
              {!search && (
                <p className="text-xs mt-1">Start a conversation to begin</p>
              )}
            </div>
          ) : (
            // Sessions list
            <div className="space-y-1">
              {filteredSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => handleSelectSession(session.id)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer with count */}
      {sessions.length > 0 && (
        <div className="border-t p-3 text-xs text-muted-foreground text-center shrink-0">
          {sessions.length} {sessions.length === 1 ? 'chat' : 'chats'}
        </div>
      )}
    </div>
  );
}
