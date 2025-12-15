"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      // During build time or when URL is missing, throw a helpful error
      // This will be caught during static generation
      throw new Error(
        "Missing NEXT_PUBLIC_CONVEX_URL environment variable. " +
        "Run 'npx convex dev' and copy the URL to your .env.local file."
      );
    }
    return new ConvexReactClient(url);
  }, []);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
