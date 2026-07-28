"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckIcon, CopyIcon, RotateCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { CitationList } from "@/components/chat/citation-list";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DisplayMessage } from "@/hooks/use-chat";

function MessageBubbleImpl({
  message,
  fileNames,
  knowledgeBaseId,
  isLast = false,
  onRegenerate,
}: {
  message: DisplayMessage;
  fileNames?: Record<string, string>;
  knowledgeBaseId: string;
  isLast?: boolean;
  onRegenerate?: () => void;
}) {
  const { copied, copy } = useCopyToClipboard();
  const isUser = message.role === "USER";
  const reducedMotion = useReducedMotion();

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[65ch] rounded-lg bg-muted/60 px-3.5 py-2 text-sm">{message.content}</div>
      </div>
    );
  }

  const showTyping = message.pending && message.content.length === 0;
  const isStreamingText = message.pending && message.content.length > 0;

  return (
    <motion.div
      className="group flex justify-start"
      initial={reducedMotion ? false : "hidden"}
      animate="show"
      variants={fadeUp}
    >
      <div className="max-w-[68ch] text-foreground">
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <>
            <div className="relative">
              <MarkdownContent
                content={message.content}
                citations={message.citations}
                fileNames={fileNames}
                knowledgeBaseId={knowledgeBaseId}
              />
              {isStreamingText && (
                <span className="animate-caret-blink ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-current align-middle" />
              )}
            </div>
            <CitationList
              citations={message.citations}
              fileNames={fileNames}
              knowledgeBaseId={knowledgeBaseId}
            />
          </>
        )}
        {!message.pending && message.content.length > 0 && (
          <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground"
                  onClick={() => void copy(message.content)}
                  aria-label={copied ? "Copied" : "Copy message"}
                >
                  {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied" : "Copy message"}</TooltipContent>
            </Tooltip>
            {isLast && onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground"
                    onClick={onRegenerate}
                    aria-label="Regenerate response"
                  >
                    <RotateCwIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate response</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

export function StreamErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={cn("mx-auto flex max-w-md items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive")}>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          Retry
        </Button>
      )}
    </div>
  );
}
