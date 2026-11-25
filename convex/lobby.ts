import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createGame } from "../app/lib/game";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const PRESENCE_MS = 45000;
const CHALLENGE_MS = 120000;
async function identity(ctx: QueryCtx | MutationCtx) { const user = await ctx.auth.getUserIdentity(); if (!user) throw new Error("Please sign in."); return user.subject; }
const active = (player: Doc<"lobbyPlayers"> | null) => !!player && player.seen > Date.now() - PRESENCE_MS;
const recent = (challenge: Doc<"challenges">) => challenge.createdAt > Date.now() - CHALLENGE_MS;
export const heartbeat = mutation({ args: {name: v.string(), lease: v.string()}, handler: async (ctx, {name, lease}) => {
  const userId = await identity(ctx); name = name.trim(); if (name.length < 2 || name.length > 24 || lease.length > 80) throw new Error("Invalid lobby profile.");
  const player = await ctx.db.query("lobbyPlayers").withIndex("by_user", q => q.eq("userId", userId)).unique();
  if (player) await ctx.db.patch(player._id, {name, lease, seen: Date.now()}); else await ctx.db.insert("lobbyPlayers", {userId, name, lease, seen: Date.now()});
} });
export const leave = mutation({ args: {lease: v.string()}, handler: async (ctx, {lease}) => { const userId = await identity(ctx); const player = await ctx.db.query("lobbyPlayers").withIndex("by_user", q => q.eq("userId", userId)).unique(); if (player?.lease === lease) await ctx.db.patch(player._id, {seen: 0}); } });
export const list = query({ args: {}, handler: async ctx => {
  const userId = await identity(ctx);
  const players = await ctx.db.query("lobbyPlayers").withIndex("by_seen", q => q.gt("seen", Date.now() - PRESENCE_MS)).collect();
  const incoming = await ctx.db.query("challenges").withIndex("by_to", q => q.eq("to", userId)).collect();
  const outgoing = await ctx.db.query("challenges").withIndex("by_from", q => q.eq("from", userId)).collect();
  return {players: players.filter(p => p.userId !== userId).map(p => ({userId: p.userId, name: p.name})), incoming: incoming.filter(c => recent(c) && (c.status === "pending" || c.status === "accepted")), outgoing: outgoing.filter(c => recent(c) && (c.status === "pending" || c.status === "accepted" || c.status === "declined"))};
} });
export const challenge = mutation({ args: {to: v.string()}, handler: async (ctx, {to}) => {
  const userId = await identity(ctx); const me = await ctx.db.query("lobbyPlayers").withIndex("by_user", q => q.eq("userId", userId)).unique(); const target = await ctx.db.query("lobbyPlayers").withIndex("by_user", q => q.eq("userId", to)).unique();
  if (!active(me) || !active(target) || userId === to) throw new Error("That player is no longer available.");
  const outgoing = await ctx.db.query("challenges").withIndex("by_from", q => q.eq("from", userId)).collect(); const incoming = await ctx.db.query("challenges").withIndex("by_to", q => q.eq("to", userId)).collect();
  if ([...outgoing, ...incoming].some(c => c.status === "pending" && recent(c))) throw new Error("Finish your current challenge first.");
  await ctx.db.insert("challenges", {from: userId, to, fromName: me!.name, toName: target!.name, status: "pending", createdAt: Date.now()});
} });
export const respond = mutation({ args: {id: v.id("challenges"), accept: v.boolean()}, handler: async (ctx, {id, accept}) => {
  const userId = await identity(ctx); const c = await ctx.db.get(id); if (!c || c.to !== userId || c.status !== "pending" || !recent(c)) throw new Error("This challenge is no longer available.");
  if (!accept) { await ctx.db.patch(id, {status: "declined"}); return; }
  const from = await ctx.db.query("lobbyPlayers").withIndex("by_user", q => q.eq("userId", c.from)).unique(); const to = await ctx.db.query("lobbyPlayers").withIndex("by_user", q => q.eq("userId", c.to)).unique();
  if (!active(from) || !active(to)) throw new Error("The other player has left the lobby.");
  const related = await Promise.all([ctx.db.query("challenges").withIndex("by_from", q => q.eq("from", c.from)).collect(), ctx.db.query("challenges").withIndex("by_to", q => q.eq("to", c.from)).collect(), ctx.db.query("challenges").withIndex("by_from", q => q.eq("from", c.to)).collect(), ctx.db.query("challenges").withIndex("by_to", q => q.eq("to", c.to)).collect()]);
  const code = crypto.randomUUID(); const names = [from!.name, to!.name]; const state = createGame("local2"); state.players = state.players.map((p, i) => ({...p, name: names[i]}));
  await ctx.db.insert("games", {code, users: [c.from, c.to], names, state, createdAt: Date.now()});
  await ctx.db.patch(id, {status: "accepted", gameCode: code});
  for (const other of new Map(related.flat().filter(other => other._id !== id && other.status === "pending").map(other => [other._id, other])).values()) await ctx.db.patch(other._id, {status: "closed"});
  await ctx.db.patch(from!._id, {seen: 0}); await ctx.db.patch(to!._id, {seen: 0});
} });
export const dismiss = mutation({ args: {id: v.id("challenges")}, handler: async (ctx, {id}) => { const userId = await identity(ctx); const c = await ctx.db.get(id); if (c && c.status !== "accepted" && (c.from === userId || c.to === userId)) await ctx.db.patch(id, {status: "closed"}); } });
