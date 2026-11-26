import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  scores: defineTable({ userId: v.string(), name: v.string(), score: v.number(), scoredAt: v.optional(v.number()), source: v.string() }).index("by_user", ["userId"]).index("by_score", ["score"]),
  scoreHistory: defineTable({ userId: v.string(), name: v.string(), score: v.number(), scoredAt: v.number(), source: v.string() }).index("by_date", ["scoredAt"]),
  lobbyPlayers: defineTable({ userId: v.string(), name: v.string(), lease: v.string(), seen: v.number() }).index("by_user", ["userId"]).index("by_seen", ["seen"]),
  challenges: defineTable({ from: v.string(), to: v.string(), fromName: v.string(), toName: v.string(), status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined"), v.literal("closed")), createdAt: v.number(), gameCode: v.optional(v.string()) }).index("by_from", ["from"]).index("by_to", ["to"]),
  games: defineTable({ code: v.string(), users: v.array(v.string()), names: v.array(v.string()), state: v.any(), createdAt: v.number(), presence: v.optional(v.array(v.number())), forfeitedBy: v.optional(v.string()) }).index("by_code", ["code"]),
});
