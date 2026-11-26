"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

type Period = "day" | "week" | "month" | "all";
const periods: { id: Period; label: string }[] = [{ id: "day", label: "Today" }, { id: "week", label: "This week" }, { id: "month", label: "This month" }, { id: "all", label: "All time" }];
function startOfPeriod(period: Period, now: number) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  if (period === "week") date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  if (period === "month") date.setUTCDate(1);
  return date.getTime();
}
function Scores({ period, now }: { period: Period; now: number }) {
  const all = useQuery(api.play.leaders, period === "all" ? {} : "skip");
  const recent = useQuery(api.play.periodLeaders, period !== "all" ? { since: startOfPeriod(period, now) } : "skip");
  const scores = period === "all" ? all : recent;
  if (!scores) return <p>Loading scores…</p>;
  if (!scores.length) return <p>No scores yet.</p>;
  return <ol className="leaderboard-list">{scores.map((entry, index) => <li key={entry._id}><span className="leaderboard-rank">{index + 1}</span><strong>{entry.name}</strong><span className="leaderboard-points">{entry.score} <small>points</small></span></li>)}</ol>;
}
export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("day");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  return <section className="leaderboard-page" aria-labelledby="leaderboard-title"><h2 id="leaderboard-title">Leaderboard</h2><div className="leaderboard-tabs" aria-label="Leaderboard period">{periods.map(item => <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => { setNow(Date.now()); setPeriod(item.id); }}>{item.label}</button>)}</div><p className="leaderboard-note">Daily, weekly and monthly scores reset at midnight UTC. Weeks begin on Sunday.</p>{process.env.NEXT_PUBLIC_CONVEX_URL ? <Scores period={period} now={now} /> : <p>Leaderboard is unavailable right now.</p>}</section>;
}
