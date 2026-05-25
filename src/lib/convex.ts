import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl && typeof window !== "undefined") {
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` in web/ to provision a Convex deployment.",
  );
}

export const convex = new ConvexReactClient(convexUrl ?? "https://placeholder.convex.cloud");
