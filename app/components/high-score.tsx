"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function AccountHighScore({ deviceScore, className }: { deviceScore: number | null; className: string }) {
  const { isAuthenticated } = useConvexAuth();
  const score = useQuery(api.play.myScore, isAuthenticated ? {} : "skip");
  if (isAuthenticated && score === undefined) return <p className={className}>Your high score: <span>—</span></p>;
  return <p className={className}>{score != null ? "Your high score" : "Device high score"}: <span>{score ?? deviceScore ?? "—"}</span></p>;
}

export function HighScore({ deviceScore, className }: { deviceScore: number | null; className: string }) {
  const { isSignedIn } = useAuth();
  if (isSignedIn && process.env.NEXT_PUBLIC_CONVEX_URL) return <AccountHighScore deviceScore={deviceScore} className={className} />;
  return <p className={className}>Device high score: <span>{deviceScore ?? "—"}</span></p>;
}
