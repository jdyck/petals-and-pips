"use client";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
const client = process.env.NEXT_PUBLIC_CONVEX_URL ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL) : null;
export function ConvexProvider({ children }: { children: ReactNode }) {
  return client ? <ConvexProviderWithClerk client={client} useAuth={useAuth}>{children}</ConvexProviderWithClerk> : <>{children}</>;
}
