"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { duration, ease, transition } from "@/lib/motion";

export function PipelineStage({
  icon: Icon,
  label,
  active,
  complete,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  complete: boolean;
  /** Jumps the demo to this stage and hands control to the visitor —
   * see PipelineDemo's own comment on why autoplay stops once clicked. */
  onSelect: () => void;
}) {
  const lit = active || complete;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Show the ${label} stage`}
      aria-pressed={active}
      className="flex shrink-0 flex-col items-center gap-2.5 rounded-lg px-1 outline-none transition-transform duration-150 ease-out active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <motion.div
        animate={{ scale: active ? 1.08 : 1 }}
        transition={transition(duration.moderate, ease.out)}
        className={cn(
          "flex size-10 items-center justify-center rounded-xl border bg-card transition-colors duration-300 hover:border-primary/30",
          lit ? "border-primary/50 ring-4 ring-primary/10" : "border-border",
        )}
      >
        <Icon
          className={cn(
            "size-4.5 transition-colors duration-300",
            lit ? "text-primary" : "text-muted-foreground",
          )}
        />
      </motion.div>
      <span
        className={cn(
          "text-small font-medium whitespace-nowrap transition-colors duration-300",
          lit ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}
