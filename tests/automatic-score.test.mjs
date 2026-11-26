import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

test("client-supplied scores cannot create or update leaderboard entries", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => { await ctx.db.insert("scores", { userId: "player", name: "Player", score: 200, source: "local" }); });
  const player = t.withIdentity({ subject: "player" });
  for (const [mutation, args] of [
    [api.play.submitLocal, { name: "Player", score: 1575 }],
    [api.play.updateExistingLocal, { score: 1575 }],
  ]) await expect(player.mutation(mutation, args)).rejects.toThrow("Local scores cannot be submitted");
  expect(await player.query(api.play.myScore, {})).toBe(200);
  expect(await player.query(api.play.periodLeaders, { since: 0 })).toEqual([]);
});

test("device import keeps the best score and does not add an undated score to period rankings", async () => {
  const t = convexTest(schema, modules);
  const player = t.withIdentity({ subject: "player" });
  await player.mutation(api.play.importDevice, { name: "Rose", score: 312 });
  await player.mutation(api.play.importDevice, { name: "Rose", score: 200 });
  expect(await player.query(api.play.myScore, {})).toBe(312);
  expect(await player.query(api.play.periodLeaders, { since: 0 })).toEqual([]);
  await player.mutation(api.play.importDevice, { name: "Rose", score: 400 });
  expect(await player.query(api.play.myScore, {})).toBe(400);
  await expect(player.mutation(api.play.importDevice, { name: "Rose", score: 1576 })).rejects.toThrow("Invalid device score");
  await expect(t.mutation(api.play.importDevice, { name: "Rose", score: 300 })).rejects.toThrow("Please sign in");
});
