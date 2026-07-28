"use client";

import { useState } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(resetDelayMs = 1500) {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelayMs);
    } catch {
      toast.error("Couldn't copy to clipboard. Please copy it manually.");
    }
  }

  return { copied, copy, reset: () => setCopied(false) };
}
