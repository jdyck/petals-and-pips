"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

export function SaveLocalScore({ score, name }: { score: number; name: string | null }) {
  const { isAuthenticated } = useConvexAuth();
  const save = useMutation(api.play.recordLocalGame);
  const [id] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState<"waiting" | "saving" | "saved" | "error">("waiting");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isAuthenticated || !name) return;
    let active = true;
    setStatus("saving");
    void save({ score, name, submissionId: id }).then(() => { if (active) setStatus("saved"); }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [isAuthenticated, name, score, id, save, attempt]);
  if (status === "error") return <p role="alert">Could not save your score. <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button></p>;
  if (status === "saved") return <p>Your score was saved to the leaderboard.</p>;
  return <p>{status === "saving" ? "Saving your score…" : isAuthenticated ? "Set a screen name to save your score." : "Sign in to save your score to the leaderboard."}</p>;
}
