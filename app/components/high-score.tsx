"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

function AccountHighScore({ deviceScore, className }: { deviceScore: number | null; className: string }) {
  const { isAuthenticated } = useConvexAuth();
  const score = useQuery(api.play.myScore, isAuthenticated ? {} : "skip");
  const importDevice = useMutation(api.play.importDevice);
  useEffect(() => {
    if (!isAuthenticated || deviceScore === null || score === undefined || (score !== null && score >= deviceScore)) return;
    let cancelled = false;
    fetch("/api/screen-name")
      .then(response => { if (!response.ok) throw new Error("Could not load your profile."); return response.json(); })
      .then(data => { if (!cancelled) return importDevice({ score: deviceScore, name: data.screenName || "Player" }); })
      .catch(error => console.error("Could not sync device high score:", error));
    return () => { cancelled = true; };
  }, [isAuthenticated, deviceScore, score, importDevice]);
  if (isAuthenticated && score === undefined) return <p className={className}>Your high score: <span>—</span></p>;
  return <p className={className}>{score != null ? "Your high score" : "Device high score"}: <span>{score ?? deviceScore ?? "—"}</span></p>;
}

export function HighScore({ deviceScore, className }: { deviceScore: number | null; className: string }) {
  const { isSignedIn } = useAuth();
  if (isSignedIn && process.env.NEXT_PUBLIC_CONVEX_URL) return <AccountHighScore deviceScore={deviceScore} className={className} />;
  return <p className={className}>Device high score: <span>{deviceScore ?? "—"}</span></p>;
}
