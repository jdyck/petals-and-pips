import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createGame, gameReducer, totalScore, type GameState } from "../app/lib/game";

async function user(ctx: any) { const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error("Please sign in."); return identity.subject as string; }
function nameOf(name: string) { const n = name.trim(); if (n.length < 2 || n.length > 24) throw new Error("Set your Appfun screen name first."); return n; }
async function record(ctx: any, userId: string, name: string, score: number, scoredAt: number | undefined, source: string) {
  if (scoredAt !== undefined) await ctx.db.insert("scoreHistory", { userId, name, score, scoredAt, source });
  const previous = await ctx.db.query("scores").withIndex("by_user", (q: any) => q.eq("userId", userId)).unique();
  if (!previous) await ctx.db.insert("scores", { userId, name, score, ...(scoredAt === undefined ? {} : { scoredAt }), source });
  else if (score > previous.score || (score === previous.score && previous.scoredAt === undefined && scoredAt !== undefined)) await ctx.db.patch(previous._id, { name, score, scoredAt, source });
  else if (name !== previous.name) await ctx.db.patch(previous._id, { name });
}
export const leaders = query({ args: {}, handler: async (ctx) => { return (await ctx.db.query("scores").withIndex("by_score").order("desc").take(10)).map(({ _id, name, score, scoredAt, source }) => ({ _id, name, score, scoredAt, source })); } });
export const periodLeaders = query({ args: { since: v.number() }, handler: async (ctx, { since }) => {
  const entries = await ctx.db.query("scoreHistory").withIndex("by_date", q => q.gte("scoredAt", since)).collect();
  const legacy = (await ctx.db.query("scores").collect()).filter(entry => entry.scoredAt !== undefined && entry.scoredAt >= since);
  const best = new Map<string, { _id: any; userId: string; name: string; score: number; scoredAt: number; source: string }>();
  for (const entry of [...entries, ...legacy.map(entry => ({ ...entry, scoredAt: entry.scoredAt! }))]) if (!best.has(entry.userId) || entry.score > best.get(entry.userId)!.score) best.set(entry.userId, entry);
  return [...best.values()].sort((a, b) => b.score - a.score || a.scoredAt - b.scoredAt).slice(0, 10).map(({ _id, name, score, scoredAt, source }) => ({ _id, name, score, scoredAt, source }));
} });
export const recordLocalGame = mutation({ args: { score: v.number(), name: v.string(), submissionId: v.string() }, handler: async (ctx, { score, name, submissionId }) => {
  const id = await user(ctx);
  if (!Number.isSafeInteger(score) || score < 0 || score > 1575 || submissionId.length < 1 || submissionId.length > 100) throw new Error("Invalid score.");
  const existing = await ctx.db.query("scoreHistory").withIndex("by_submission", q => q.eq("userId", id).eq("submissionId", submissionId)).unique();
  if (existing) return;
  const validName = nameOf(name);
  await ctx.db.insert("scoreHistory", { userId: id, name: validName, score, scoredAt: Date.now(), source: "local", submissionId });
  await record(ctx, id, validName, score, undefined, "local");
} });
export const updateScoreName = mutation({ args: { name: v.string() }, handler: async (ctx, {name}) => { const id = await user(ctx); const score = await ctx.db.query("scores").withIndex("by_user", q => q.eq("userId", id)).unique(); if (score) await ctx.db.patch(score._id, {name: nameOf(name)}); } });
export const myScore = query({ args: {}, handler: async (ctx) => { const id = await user(ctx); const score = await ctx.db.query("scores").withIndex("by_user", q => q.eq("userId", id)).unique(); return score?.score ?? null; } });
// Device imports are unverified; other local score submissions remain disabled.
const unverifiedScore = () => { throw new Error("Local scores cannot be submitted to the leaderboard."); };
export const importDevice = mutation({ args: { score: v.number(), name: v.string() }, handler: async (ctx, { score, name }) => {
  const id = await user(ctx);
  if (!Number.isSafeInteger(score) || score < 0 || score > 1575) throw new Error("Invalid device score.");
  const previous = await ctx.db.query("scores").withIndex("by_user", q => q.eq("userId", id)).unique();
  if (!previous || score > previous.score) await record(ctx, id, previous?.name ?? nameOf(name), score, undefined, "device");
} });
export const submitLocal = mutation({ args: { score: v.number(), name: v.string() }, handler: unverifiedScore });
export const updateExistingLocal = mutation({ args: { score: v.number() }, handler: unverifiedScore });
export const getGame = query({ args: { code: v.string() }, handler: async (ctx, {code}) => { const id = await user(ctx); const game = await ctx.db.query("games").withIndex("by_code", q => q.eq("code", code)).unique(); if (!game || !game.users.includes(id)) return null; return { state: game.state as GameState, seat: game.users.indexOf(id), count: game.users.length, code: game.code, forfeitedBy: game.forfeitedBy ? game.users.indexOf(game.forfeitedBy) : null, opponentLastSeen: game.presence?.[1 - game.users.indexOf(id)] ?? game.createdAt, serverTime: Date.now() }; } });
export const heartbeat = mutation({ args: { code: v.string() }, handler: async (ctx, { code }) => {
  const id = await user(ctx);
  const game = await ctx.db.query("games").withIndex("by_code", q => q.eq("code", code)).unique();
  const seat = game?.users.indexOf(id) ?? -1;
  if (!game || seat < 0 || game.forfeitedBy || game.state.phase === "finished") return;
  const presence = game.presence ?? game.users.map(() => game.createdAt);
  presence[seat] = Date.now();
  await ctx.db.patch(game._id, { presence });
} });
export const leaveGame = mutation({ args: { code: v.string() }, handler: async (ctx, { code }) => {
  const id = await user(ctx);
  const game = await ctx.db.query("games").withIndex("by_code", q => q.eq("code", code)).unique();
  if (!game || !game.users.includes(id)) throw new Error("Game unavailable.");
  if (!game.forfeitedBy && game.state.phase !== "finished") await ctx.db.patch(game._id, { forfeitedBy: id });
} });
export const act = mutation({ args: { code: v.string(), action: v.union(v.literal("roll"), v.literal("hold"), v.literal("score")), index: v.optional(v.number()) }, handler: async (ctx, {code, action, index}) => { const id = await user(ctx); const game = await ctx.db.query("games").withIndex("by_code", q => q.eq("code", code)).unique(); if (!game || game.forfeitedBy || game.users.length !== 2 || game.users[game.state.currentPlayer] !== id) throw new Error("It is not your turn."); let state: GameState = game.state; if (state.celebration) state = gameReducer(state, {type: "dismissCelebration"}); if (state.phase === "handoff") state = gameReducer(state, {type: "ready"}); if (action === "roll") { const dice = Array.from({length: 5}, (_, i) => state.held[i] && state.dice.length ? state.dice[i] : Math.floor(Math.random() * 6) + 1); state = gameReducer(state, {type: "roll", dice}); state = gameReducer(state, {type: "settle"}); if (state.celebration) state = gameReducer(state, {type: "dismissCelebration"}); } else { if (!Number.isInteger(index) || index! < 0 || index! >= (action === "hold" ? 5 : 13)) throw new Error("Invalid choice."); state = gameReducer(state, { type: action, index: index! }); } await ctx.db.patch(game._id, {state}); if (state.phase === "finished") for (let i = 0; i < 2; i++) await record(ctx, game.users[i], game.names[i], totalScore(state.players[i].scores, state.players[i].bonus), Date.now(), "online"); } });
