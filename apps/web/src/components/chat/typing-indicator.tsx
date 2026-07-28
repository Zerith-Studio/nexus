"use client";

import { motion, useReducedMotion } from "framer-motion";

import { duration, ease } from "@/lib/motion";

export function TypingIndicator() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/60"
          animate={reducedMotion ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: duration.slow,
            ease: ease.inOut,
            repeat: Infinity,
            delay: i * 0.12,
          }}
        />
      ))}
    </div>
  );
}
