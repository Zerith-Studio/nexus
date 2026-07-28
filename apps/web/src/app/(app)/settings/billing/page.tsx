"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckIcon, CreditCardIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/lib/session-context";
import { useCreatePortalSession } from "@/hooks/use-billing";
import { PaddleCheckoutButton } from "@/components/billing/paddle-checkout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  paused: "warning",
  canceled: "outline",
};

// Mirrors the Pro tier's own copy in lib/tiers.ts (kept as a plain local
// constant rather than importing that module here — tiers.ts throws at
// import time if the Paddle price env vars are unset, which is the right
// failure mode for the pricing page but too fragile a dependency to pull
// into a settings page that otherwise has nothing to do with checkout).
const PRO_FEATURES = ["Multiple knowledge bases", "Higher document & request limits", "Full API access with scoped keys"];

export default function BillingPage() {
  const { currentOrganization, user } = useSession();
  const createPortalSession = useCreatePortalSession(currentOrganization.id);
  const canManage = currentOrganization.role === "OWNER" || currentOrganization.role === "ADMIN";

  const hasSubscription = Boolean(currentOrganization.paddleCustomerId);

  async function handleManageBilling() {
    try {
      const { url } = await createPortalSession.mutateAsync();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Couldn't open the billing portal. Please try again.");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="py-5">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Plan</CardTitle>
          <Badge variant="outline" className="uppercase">
            {currentOrganization.plan}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentOrganization.subscriptionStatus && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              Subscription status:
              <Badge variant={STATUS_VARIANT[currentOrganization.subscriptionStatus] ?? "outline"} className="capitalize">
                {currentOrganization.subscriptionStatus.replace("_", " ")}
              </Badge>
            </p>
          )}

          {!canManage ? (
            <p className="text-sm text-muted-foreground">Only an owner or admin can manage billing for this organization.</p>
          ) : hasSubscription ? (
            <div className="space-y-2">
              <Button variant="outline" onClick={() => void handleManageBilling()} disabled={createPortalSession.isPending}>
                <CreditCardIcon /> Manage billing <ExternalLinkIcon className="size-3.5" />
              </Button>
              {currentOrganization.subscriptionUpdatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced {formatDistanceToNow(new Date(currentOrganization.subscriptionUpdatedAt), { addSuffix: true })}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <div>
                <p className="text-sm font-medium">You&apos;re on the Free plan</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Upgrade to Pro to unlock:</p>
              </div>
              <ul className="space-y-1.5">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckIcon className="size-3.5 shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 pt-1">
                <PaddleCheckoutButton organizationId={currentOrganization.id} email={user.email}>
                  Upgrade to Pro
                </PaddleCheckoutButton>
                <Link href="/pricing" className="text-sm font-medium text-primary hover:text-primary/80">
                  See all plans
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
