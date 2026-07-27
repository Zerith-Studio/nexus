"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { aggregateDailyUsage } from "@/lib/usage";
import { duration, ease, transition } from "@/lib/motion";
import type { UsageBreakdownRow } from "@/lib/types";

/**
 * Shared daily-token-usage bar chart — used by both the dashboard's compact
 * usage summary and the full usage settings page. Previously two
 * independently hand-rolled implementations (one with a hover tooltip and
 * no motion, one with a stagger-in reveal and no tooltip); this merges both
 * behaviors into a single component instead of keeping two divergent
 * copies of the same chart.
 */
export function UsageBarChart({
  breakdown,
  days,
  height = "h-40",
  showTooltip = true,
  emptyMessage = "No usage recorded in this period.",
}: {
  breakdown: UsageBreakdownRow[];
  days: number;
  height?: string;
  showTooltip?: boolean;
  emptyMessage?: string;
}) {
  const reducedMotion = useReducedMotion();
  const daily = useMemo(() => aggregateDailyUsage(breakdown, days), [breakdown, days]);
  const max = Math.max(1, ...daily.map(([, tokens]) => tokens));

  if (daily.length === 0) {
    return <p className={cn("flex items-center justify-center text-sm text-muted-foreground", height)}>{emptyMessage}</p>;
  }

  return (
    <div className={cn("flex items-end gap-1", height)}>
      {daily.map(([date, tokens], index) => (
        <div key={date} className="group relative flex-1">
          <motion.div
            initial={reducedMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={reducedMotion ? { duration: 0 } : { ...transition(duration.moderate, ease.out), delay: index * 0.02 }}
            style={{ height: `${Math.max(4, (tokens / max) * 100)}%`, transformOrigin: "bottom" }}
            className="w-full rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
          />
          {showTooltip && (
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-caption text-background group-hover:block">
              {format(new Date(date), "MMM d")} · {tokens.toLocaleString()} tokens
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
