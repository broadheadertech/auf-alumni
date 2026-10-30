/**
 * In-app user guide — alumni surface.
 *
 * Content lives in src/lib/guide/content.ts; this route only supplies the
 * surface so the reader gets the walkthroughs for the tabs they actually have.
 */

import type { Metadata } from "next";
import { GuideBook } from "@/components/auf/GuideBook";

export const metadata: Metadata = {
  title: "How to use the AUF Alumni Network",
  description:
    "Step-by-step walkthroughs for every tab, written to be read on day one and reopened whenever you need a refresher.",
};

export default function GuidePage() {
  return <GuideBook surface="alumni" />;
}
