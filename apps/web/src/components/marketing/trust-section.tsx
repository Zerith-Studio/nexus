"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ActivityIcon, GaugeIcon, QuoteIcon, ShieldIcon } from "lucide-react";

import { fadeUp, staggerContainer } from "@/lib/motion";
import { Card } from "@/components/ui/card";

// The two strongest, most concrete claims get full cards; the other two
// fold into a supporting line inside them instead of four equal-weight
// tiles that read as filler — data isolation and citation integrity are
// the claims worth a reader's full attention, not a fifth of it each.
const guarantees = [
  {
    icon: ShieldIcon,
    title: "Isolated by design",
    description:
      "Every organization's data lives in its own row-level-secured slice of the database — enforced at the database layer, not just application code.",
    supporting: { icon: GaugeIcon, text: "Scoped API keys, per-organization rate limits, and usage tracked to the token." },
  },
  {
    icon: QuoteIcon,
    title: "Citations you can verify",
    description:
      "Every source cited in an answer is checked against the documents actually retrieved for that request. If a claim isn't backed by your documents, it isn't cited.",
    supporting: { icon: ActivityIcon, text: "Failed or stuck processing shows up in your dashboard immediately — not in a support ticket." },
  },
];

export function TrustSection() {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="architecture" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-xl">
          <h2 className="text-h2 text-balance">
            Trust is an architecture decision, not a marketing page
          </h2>
          <p className="mt-3 text-muted-foreground text-pretty">
            These are guarantees the system enforces, not claims we make.
          </p>
        </div>
        <motion.div
          ref={ref}
          className="mt-12 grid gap-6 sm:grid-cols-2"
          initial={reducedMotion ? false : "hidden"}
          animate={reducedMotion || inView ? "show" : "hidden"}
          variants={staggerContainer(0.08)}
        >
          {guarantees.map((item) => (
            <motion.div key={item.title} variants={fadeUp} className="h-full">
              <Card interactive className="h-full gap-0 p-7">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-5 flex items-start gap-2.5 border-t border-border pt-4 text-sm text-muted-foreground">
                  <item.supporting.icon className="mt-0.5 size-4 shrink-0" />
                  {item.supporting.text}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
