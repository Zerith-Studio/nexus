"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createApiKeySchema, type CreateApiKeyInput } from "@raas/shared";
import { motion, useReducedMotion } from "framer-motion";
import { CheckIcon, CopyIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fadeUp } from "@/lib/motion";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useCreateApiKey } from "@/hooks/use-api-keys";

export function CreateApiKeyDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createApiKey = useCreateApiKey(organizationId);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { copied, copy, reset: resetCopied } = useCopyToClipboard();
  const reducedMotion = useReducedMotion();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateApiKeyInput>({ resolver: zodResolver(createApiKeySchema) });

  async function onSubmit(values: CreateApiKeyInput) {
    try {
      const { key } = await createApiKey.mutateAsync({
        name: values.name,
        expiresAt: values.expiresAt?.toISOString(),
      });
      setCreatedKey(key);
    } catch {
      toast.error("Couldn't create API key. Please try again.");
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
      setCreatedKey(null);
      resetCopied();
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdKey ? "Key created" : "New API key"}</DialogTitle>
          <DialogDescription>
            {createdKey
              ? "This is the only time you'll see the full key."
              : "Use this key to authenticate requests to the public API."}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <motion.div
            initial={reducedMotion ? false : "hidden"}
            animate="show"
            variants={fadeUp}
          >
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <p>Copy this key now and store it securely — for security, we can&apos;t show it to you again.</p>
            </div>
            <div className="mt-3 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2.5">
              <span className="whitespace-nowrap font-mono text-sm">{createdKey}</span>
            </div>
            <Button
              onClick={() => void copy(createdKey)}
              variant={copied ? "outline" : "default"}
              className="mt-3 w-full"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy key"}
            </Button>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" autoFocus placeholder="Production server" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2Icon className="animate-spin" />}
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
