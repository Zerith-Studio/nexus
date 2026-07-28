"use client";

import { use, useMemo } from "react";

import { useSession } from "@/lib/session-context";
import { useKnowledgeBase } from "@/hooks/use-knowledge-bases";
import { useMessages } from "@/hooks/use-conversations";
import { ChatView } from "@/components/chat/chat-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string; conversationId?: string[] }>;
}) {
  const { id, conversationId: conversationIdParam } = use(params);
  const conversationId = conversationIdParam?.[0];
  const { currentOrganization } = useSession();

  const kb = useKnowledgeBase(id, currentOrganization.id);
  const messages = useMessages(conversationId ?? "", currentOrganization.id);

  const initialMessages = useMemo(() => {
    if (!messages.data) return undefined;
    return [...messages.data.data].reverse();
  }, [messages.data]);

  if (kb.isLoading || (conversationId && messages.isLoading)) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-border md:block">
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-8 w-full rounded-md" />
            <div className="space-y-1.5 pt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
            <div className="flex justify-start">
              <div className="w-2/3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-9 w-1/3 rounded-lg" />
            </div>
            <div className="flex justify-start">
              <div className="w-1/2 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
          <div className="border-t border-border p-4">
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!kb.data) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Knowledge base not found.
      </div>
    );
  }

  return (
    <ChatView
      knowledgeBase={kb.data}
      organizationId={currentOrganization.id}
      conversationId={conversationId}
      initialMessages={initialMessages}
    />
  );
}
