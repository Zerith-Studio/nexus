"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { DatabaseIcon, GaugeIcon, KeyRoundIcon, MessagesSquareIcon, UsersIcon } from "lucide-react";

import { API_URL } from "@/lib/config";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { EndpointBadge } from "@/components/docs/doc-page";
import { CodeTabs } from "@/components/docs/code-tabs";

const storyFeatures = [
  {
    icon: MessagesSquareIcon,
    title: "Grounded, cited chat",
    description:
      "Every answer streams in real time and links back to the exact source passages it was built from — not a paraphrase, the actual quote and page.",
    image: { src: "/marketing/chat-citations.jpg", alt: "A Nexus chat answer with an inline citation showing the exact quoted source passage" },
  },
  {
    icon: DatabaseIcon,
    title: "Isolated knowledge bases",
    description:
      "Organize documents into knowledge bases per product, team, or customer, each with its own independent retrieval scope — nothing bleeds across boundaries.",
    image: { src: "/marketing/kb-detail.jpg", alt: "A Nexus knowledge base detail page showing document stats and an indexed document" },
  },
];

// The other three points the old 4-card grid made (team workspaces,
// usage tracking) fold in here as short supporting lines next to the real
// code sample, instead of as their own generic icon+title+paragraph
// cards duplicating the story cards' shape one section down.
const integrationPoints = [
  { icon: KeyRoundIcon, text: "Every dashboard action has a matching, scoped API key." },
  { icon: UsersIcon, text: "Invite teammates with org-level roles — owner, admin, member." },
  { icon: GaugeIcon, text: "Tokens, requests, and cost tracked per organization, daily." },
];

/**
 * Deliberately the real GET /v1/knowledge-bases/:id/documents endpoint —
 * the only one actually shipped on the public API today (see /docs).
 * Upload and chat are dashboard-only for now; showing a "create KB, upload
 * a doc, query it" snippet here would look like a create/upload/query API
 * that doesn't exist. This is the same request docs/page.tsx's own
 * "first request" walkthrough uses — the landing page and the docs never
 * disagree about what the API can do.
 */
const apiExamples = {
  bash: `curl "${API_URL}/v1/knowledge-bases/kb_123/documents?limit=20" \\
  -H "Authorization: Bearer rk_live_..."`,
  javascript: `const res = await fetch(
  \`${API_URL}/v1/knowledge-bases/kb_123/documents?limit=20\`,
  { headers: { Authorization: "Bearer rk_live_..." } }
);
const { data: documents, nextCursor } = await res.json();

// Poll status until ingestion finishes
documents.find((d) => d.id === uploadedId)?.status; // "READY"`,
  python: `import requests

res = requests.get(
    "${API_URL}/v1/knowledge-bases/kb_123/documents",
    headers={"Authorization": "Bearer rk_live_..."},
    params={"limit": 20},
)
documents = res.json()["data"]`,
};

export function Features() {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <h2 className="text-h2 text-balance">
            Everything you need to ship RAG, nothing you have to build yourself
          </h2>
          <p className="mt-3 text-muted-foreground text-pretty">
            Focus on your product. We handle the retrieval infrastructure underneath it.
          </p>
        </div>

        <motion.div
          ref={ref}
          className="mt-12 grid gap-6 lg:grid-cols-2"
          initial={reducedMotion ? false : "hidden"}
          animate={reducedMotion || inView ? "show" : "hidden"}
          variants={staggerContainer(0.08)}
        >
          {storyFeatures.map((feature) => (
            <motion.div key={feature.title} variants={fadeUp} className="h-full">
              <Card interactive className="h-full gap-0 overflow-hidden p-8">
                <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                <div className="mt-6 -mx-8 -mb-8 overflow-hidden border-t border-border">
                  <Image
                    src={feature.image.src}
                    alt={feature.image.alt}
                    width={1512}
                    height={786}
                    className="w-full"
                  />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-6 grid gap-6 lg:grid-cols-5"
          initial={reducedMotion ? false : "hidden"}
          animate={reducedMotion || inView ? "show" : "hidden"}
          variants={staggerContainer(0.08)}
        >
          <motion.div variants={fadeUp} className="lg:col-span-2">
            <h3 className="text-lg font-semibold">Nexus is infrastructure, not just a dashboard</h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Everything you can do by hand, your product can do programmatically — poll ingestion status,
              list what&apos;s indexed, and build your own UI on top of the same data the dashboard reads.
            </p>
            <ul className="mt-5 space-y-3">
              {integrationPoints.map((point) => (
                <li key={point.text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <point.icon className="mt-0.5 size-4 shrink-0 text-foreground" />
                  {point.text}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div variants={fadeUp} className="lg:col-span-3">
            <EndpointBadge method="GET" path="/v1/knowledge-bases/:id/documents" />
            <div className="mt-3">
              <CodeTabs examples={apiExamples} />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
