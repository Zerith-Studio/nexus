/**
 * Integration tests against real Postgres via app.inject() — no mocking.
 * The webhook signature check itself (packages: @paddle/paddle-node-sdk's
 * Webhooks.unmarshal) is a pure local HMAC-SHA256 computation with no
 * network call (verified directly by reading the SDK's compiled source),
 * so a real signature is computed here and genuinely verified, not
 * bypassed — this file needs PADDLE_API_KEY/PADDLE_WEBHOOK_SECRET/all 6
 * tier price ids set (see .env) for billingRoutes to even register, but
 * never calls Paddle's real API —
 * customerPortalSessions.create (the one call that would) is only reached
 * once this org has a paddleCustomerId, which none of these tests give it.
 * Prerequisites: docker compose up -d, migrations applied.
 */
import { createHmac, randomUUID } from "node:crypto";

import { prisma, withTenantTransaction } from "@raas/db";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../env.js";
import { redis } from "../lib/redis.js";
import { SESSION_COOKIE_NAME } from "../plugins/auth-guard.js";
import { signup } from "../test-support/signup.js";

function signWebhook(rawBody: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", env.PADDLE_WEBHOOK_SECRET!).update(`${ts}:${rawBody}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

function buildSubscriptionEventBody(options: {
  eventType: string;
  organizationId: string;
  status: string;
  subscriptionId?: string;
  customerId?: string;
  priceId?: string | null;
  occurredAt?: string;
}) {
  return {
    event_id: `evt_${randomUUID()}`,
    notification_id: `ntf_${randomUUID()}`,
    event_type: options.eventType,
    occurred_at: options.occurredAt ?? new Date().toISOString(),
    data: {
      id: options.subscriptionId ?? `sub_${randomUUID()}`,
      status: options.status,
      customer_id: options.customerId ?? `ctm_${randomUUID()}`,
      transaction_id: `txn_${randomUUID()}`,
      address_id: `add_${randomUUID()}`,
      currency_code: "USD",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection_mode: "automatic",
      billing_cycle: { interval: "month", frequency: 1 },
      items:
        options.priceId === null
          ? []
          : [
              {
                status: "active",
                quantity: 1,
                recurring: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                price: { id: options.priceId ?? env.PADDLE_PRO_PRICE_ID, product_id: `pro_${randomUUID()}`, description: "Pro", tax_mode: "account_setting" },
              },
            ],
      custom_data: { organizationId: options.organizationId },
    },
  };
}

describe("billing routes", () => {
  let app: FastifyInstance;
  const suffix = randomUUID().slice(0, 8);
  const password = "correct-horse-battery-staple";

  let organizationId: string;

  beforeAll(async () => {
    app = await buildApp();
    const owner = await signup(app, `billing-owner-${suffix}@example.com`, password, `Billing Org ${suffix}`);
    organizationId = owner.organizationId;
  });

  afterAll(async () => {
    await app.close();
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await redis.quit();
  });

  describe("POST /billing/webhook", () => {
    it("rejects a request with an invalid signature", async () => {
      const rawBody = JSON.stringify(
        buildSubscriptionEventBody({ eventType: "subscription.created", organizationId, status: "active" }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": "ts=1;h1=not-a-real-signature" },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects a request with no signature header at all", async () => {
      const rawBody = JSON.stringify(
        buildSubscriptionEventBody({ eventType: "subscription.created", organizationId, status: "active" }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json" },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(400);
    });

    it("a valid subscription.created event moves the org onto the Pro plan", async () => {
      const subscriptionId = `sub_${randomUUID()}`;
      const customerId = `ctm_${randomUUID()}`;
      const rawBody = JSON.stringify(
        buildSubscriptionEventBody({
          eventType: "subscription.created",
          organizationId,
          status: "active",
          subscriptionId,
          customerId,
        }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(rawBody) },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);

      const org = await withTenantTransaction(organizationId, (tx) => tx.organization.findUniqueOrThrow({ where: { id: organizationId } }));
      expect(org.plan).toBe("pro");
      expect(org.paddleSubscriptionId).toBe(subscriptionId);
      expect(org.paddleCustomerId).toBe(customerId);
      expect(org.subscriptionStatus).toBe("active");
    });

    it("a valid subscription.created event with a Starter monthly price moves the org onto the Starter plan", async () => {
      const starterOwner = await signup(app, `billing-starter-${suffix}@example.com`, password, `Billing Starter Org ${suffix}`);
      const rawBody = JSON.stringify(
        buildSubscriptionEventBody({
          eventType: "subscription.created",
          organizationId: starterOwner.organizationId,
          status: "active",
          priceId: env.PADDLE_STARTER_PRICE_ID_MONTHLY,
        }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(rawBody) },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);

      const org = await withTenantTransaction(starterOwner.organizationId, (tx) =>
        tx.organization.findUniqueOrThrow({ where: { id: starterOwner.organizationId } }),
      );
      expect(org.plan).toBe("starter");
    });

    it("a valid subscription.created event with an Advanced yearly price moves the org onto the Advanced plan", async () => {
      const advancedOwner = await signup(app, `billing-advanced-${suffix}@example.com`, password, `Billing Advanced Org ${suffix}`);
      const rawBody = JSON.stringify(
        buildSubscriptionEventBody({
          eventType: "subscription.created",
          organizationId: advancedOwner.organizationId,
          status: "active",
          priceId: env.PADDLE_ADVANCED_PRICE_ID_YEARLY,
        }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(rawBody) },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);

      const org = await withTenantTransaction(advancedOwner.organizationId, (tx) =>
        tx.organization.findUniqueOrThrow({ where: { id: advancedOwner.organizationId } }),
      );
      expect(org.plan).toBe("advanced");
    });

    it("a later subscription.canceled event reverts the org to the free plan", async () => {
      const rawBody = JSON.stringify(
        buildSubscriptionEventBody({
          eventType: "subscription.canceled",
          organizationId,
          status: "canceled",
          priceId: null,
          occurredAt: new Date(Date.now() + 1000).toISOString(),
        }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(rawBody) },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);

      const org = await withTenantTransaction(organizationId, (tx) => tx.organization.findUniqueOrThrow({ where: { id: organizationId } }));
      expect(org.plan).toBe("free");
      expect(org.subscriptionStatus).toBe("canceled");
    });

    it("ignores a stale event whose occurred_at is older than what's already recorded", async () => {
      const before = await withTenantTransaction(organizationId, (tx) => tx.organization.findUniqueOrThrow({ where: { id: organizationId } }));

      // Reactivating would normally flip the plan back to "pro" — but this
      // event claims to have occurred well before subscriptionUpdatedAt
      // (set by the subscription.canceled event above), so it must be a
      // no-op: Paddle doesn't guarantee delivery order, and a late-arriving
      // stale event must never clobber newer state.
      const staleRawBody = JSON.stringify(
        buildSubscriptionEventBody({
          eventType: "subscription.updated",
          organizationId,
          status: "active",
          occurredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(staleRawBody) },
        payload: staleRawBody,
      });

      expect(response.statusCode).toBe(200);

      const after = await withTenantTransaction(organizationId, (tx) => tx.organization.findUniqueOrThrow({ where: { id: organizationId } }));
      expect(after.plan).toBe(before.plan);
      expect(after.subscriptionStatus).toBe(before.subscriptionStatus);
      expect(after.subscriptionUpdatedAt?.getTime()).toBe(before.subscriptionUpdatedAt?.getTime());
    });

    it("acknowledges but ignores a subscription event missing organizationId in custom_data", async () => {
      const body = buildSubscriptionEventBody({ eventType: "subscription.created", organizationId, status: "active" });
      // @ts-expect-error — deliberately malformed for this test
      body.data.custom_data = null;
      const rawBody = JSON.stringify(body);

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(rawBody) },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
    });

    it("200s and does nothing for an event type it doesn't act on", async () => {
      const rawBody = JSON.stringify({
        event_id: `evt_${randomUUID()}`,
        notification_id: null,
        event_type: "customer.updated",
        occurred_at: new Date().toISOString(),
        data: { id: `ctm_${randomUUID()}` },
      });

      const response = await app.inject({
        method: "POST",
        url: "/billing/webhook",
        headers: { "content-type": "application/json", "paddle-signature": signWebhook(rawBody) },
        payload: rawBody,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("POST /billing/portal-session", () => {
    // Invites and accepts as the given role directly (inviteMemberSchema
    // allows ADMIN or MEMBER at invite time — no separate promotion step
    // needed). Local to this file since knowledge-bases.test.ts's own
    // inviteMember helper is hardcoded to MEMBER and isn't exported.
    async function inviteMember(ownerCookie: string, orgId: string, email: string, role: "ADMIN" | "MEMBER"): Promise<string> {
      const invite = await app.inject({
        method: "POST",
        url: `/organizations/${orgId}/invites`,
        cookies: { [SESSION_COOKIE_NAME]: ownerCookie },
        payload: { email, role },
      });
      const { token } = invite.json();

      const signedUp = await signup(app, email, password, `Portal Session Member Org ${randomUUID().slice(0, 8)}`);
      await app.inject({
        method: "POST",
        url: `/invites/${token}/accept`,
        cookies: { [SESSION_COOKIE_NAME]: signedUp.sessionCookie },
      });
      return signedUp.sessionCookie;
    }

    it("requires authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/billing/portal-session",
        payload: { organizationId },
      });
      expect(response.statusCode).toBe(401);
    });

    it("returns 404 for a caller who isn't a member of the organization", async () => {
      const outsider = await signup(app, `billing-outsider-${suffix}@example.com`, password, `Billing Outsider Org ${suffix}`);
      const response = await app.inject({
        method: "POST",
        url: "/billing/portal-session",
        cookies: { [SESSION_COOKIE_NAME]: outsider.sessionCookie },
        payload: { organizationId },
      });
      expect(response.statusCode).toBe(404);
    });

    // No real Paddle customer/subscription exists for any org in this
    // suite (see this file's header comment — customerPortalSessions.create
    // is never actually reached), so a caller who clears the role check
    // lands on 409 ("no active Paddle subscription"), not 200. That 409 —
    // as opposed to the 403 a MEMBER gets below — is exactly what proves
    // the role check passed for OWNER/ADMIN.
    it("returns 409, not 403, for an OWNER — proving the role check passes and the request reaches the subscription check", async () => {
      const fresh = await signup(app, `billing-fresh-${suffix}@example.com`, password, `Billing Fresh Org ${suffix}`);
      const response = await app.inject({
        method: "POST",
        url: "/billing/portal-session",
        cookies: { [SESSION_COOKIE_NAME]: fresh.sessionCookie },
        payload: { organizationId: fresh.organizationId },
      });
      expect(response.statusCode).toBe(409);
    });

    it("returns 409, not 403, for an ADMIN — proving the role check passes and the request reaches the subscription check", async () => {
      // A fresh org, not the shared `organizationId` — the webhook tests
      // above already gave that one a real paddleCustomerId/
      // paddleSubscriptionId, which would route this past the 409 and
      // into a genuine (and here, doomed to fail) Paddle API call instead
      // of testing what this test is actually for.
      const fresh = await signup(app, `billing-admin-org-${suffix}@example.com`, password, `Billing Admin Org ${suffix}`);
      const adminCookie = await inviteMember(fresh.sessionCookie, fresh.organizationId, `billing-admin-${suffix}@example.com`, "ADMIN");

      const response = await app.inject({
        method: "POST",
        url: "/billing/portal-session",
        cookies: { [SESSION_COOKIE_NAME]: adminCookie },
        payload: { organizationId: fresh.organizationId },
      });
      expect(response.statusCode).toBe(409);
    });

    it("returns 403 for a MEMBER — regression test for the billing portal authorization bypass", async () => {
      const fresh = await signup(app, `billing-member-org-${suffix}@example.com`, password, `Billing Member Org ${suffix}`);
      const memberCookie = await inviteMember(fresh.sessionCookie, fresh.organizationId, `billing-member-${suffix}@example.com`, "MEMBER");

      const response = await app.inject({
        method: "POST",
        url: "/billing/portal-session",
        cookies: { [SESSION_COOKIE_NAME]: memberCookie },
        payload: { organizationId: fresh.organizationId },
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
