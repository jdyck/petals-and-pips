"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

function AccountHighScore({ deviceScore, className, screenName }: { deviceScore: number | null; className: string; screenName: string | null }) {
  const { isAuthenticated } = useConvexAuth();
  const score = useQuery(api.play.myScore, isAuthenticated ? {} : "skip");
  const updateScoreName = useMutation(api.play.updateScoreName);
  useEffect(() => {
    if (!isAuthenticated || !screenName || score === undefined) return;
    void updateScoreName({ name: screenName }).catch(error => console.error("Could not update score name:", error));
  }, [isAuthenticated, score, screenName, updateScoreName]);
  if (isAuthenticated && score === undefined) return <p className={className}>Your high score: <span>—</span></p>;
  return <p className={className}>{score != null ? "Your high score" : "Device high score"}: <span>{score ?? deviceScore ?? "—"}</span></p>;
}

export function HighScore({ deviceScore, className, screenName }: { deviceScore: number | null; className: string; screenName: string | null }) {
  const { isSignedIn } = useAuth();
  if (isSignedIn && process.env.NEXT_PUBLIC_CONVEX_URL) return <AccountHighScore deviceScore={deviceScore} className={className} screenName={screenName} />;
  return <p className={className}>Device high score: <span>{deviceScore ?? "—"}</span></p>;
}
