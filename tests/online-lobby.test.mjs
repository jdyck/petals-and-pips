import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { rankScoreOptions } from "../app/lib/game";

const modules = import.meta.glob("../convex/**/*.ts");

test("players can challenge, accept, and enter the same game", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({subject: "alice", issuer: "https://test.example", tokenIdentifier: "https://test.example|alice"});
  const bob = t.withIdentity({subject: "bob", issuer: "https://test.example", tokenIdentifier: "https://test.example|bob"});
  await alice.mutation(api.lobby.heartbeat, {name: "Alice", lease: "alice-tab"});
  await bob.mutation(api.lobby.heartbeat, {name: "Bob", lease: "bob-tab"});
  expect((await alice.query(api.lobby.list, {})).players).toEqual([{userId: "bob", name: "Bob"}]);
  await alice.mutation(api.lobby.challenge, {to: "bob"});
  const incoming = (await bob.query(api.lobby.list, {})).incoming;
  expect(incoming).toHaveLength(1);
  await expect(alice.mutation(api.lobby.respond, {id: incoming[0]._id, accept: true})).rejects.toThrow();
  await bob.mutation(api.lobby.respond, {id: incoming[0]._id, accept: true});
  const outgoing = (await alice.query(api.lobby.list, {})).outgoing;
  const accepted = (await bob.query(api.lobby.list, {})).incoming;
  expect(outgoing[0].gameCode).toBe(accepted[0].gameCode);
  const code = accepted[0].gameCode;
  const aliceGame = await alice.query(api.play.getGame, {code});
  const bobGame = await bob.query(api.play.getGame, {code});
  expect(aliceGame.seat).toBe(0);
  expect(bobGame.seat).toBe(1);
  expect(aliceGame.state.players.map(p => p.name)).toEqual(["Alice", "Bob"]);
  await expect(bob.mutation(api.play.act, {code, action: "roll"})).rejects.toThrow();
  await alice.mutation(api.play.act, {code, action: "roll"});
  expect((await bob.query(api.play.getGame, {code})).state.rollId).toBe(1);
});

test("declined challenges do not start games and expired presence cannot be challenged", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({subject: "alice"});
  const bob = t.withIdentity({subject: "bob"});
  await alice.mutation(api.lobby.heartbeat, {name: "Alice", lease: "one"});
  await bob.mutation(api.lobby.heartbeat, {name: "Bob", lease: "two"});
  await alice.mutation(api.lobby.challenge, {to: "bob"});
  const challenge = (await bob.query(api.lobby.list, {})).incoming[0];
  await bob.mutation(api.lobby.respond, {id: challenge._id, accept: false});
  expect((await alice.query(api.lobby.list, {})).outgoing[0].status).toBe("declined");
  await bob.mutation(api.lobby.leave, {lease: "two"});
  await expect(alice.mutation(api.lobby.challenge, {to: "bob"})).rejects.toThrow("no longer available");
});

test("two players complete all 26 turns and see the same final game", async () => {
  const t = convexTest(schema, modules);
  const players = [t.withIdentity({subject: "alice"}), t.withIdentity({subject: "bob"})];
  await players[0].mutation(api.lobby.heartbeat, {name: "Alice", lease: "alice"});
  await players[1].mutation(api.lobby.heartbeat, {name: "Bob", lease: "bob"});
  await players[0].mutation(api.lobby.challenge, {to: "bob"});
  const challenge = (await players[1].query(api.lobby.list, {})).incoming[0];
  await players[1].mutation(api.lobby.respond, {id: challenge._id, accept: true});
  const code = (await players[1].query(api.lobby.list, {})).incoming[0].gameCode;
  let roll = 0;
  const random = vi.spyOn(Math, "random").mockImplementation(() => [0.05, 0.25, 0.45, 0.65, 0.85][roll++ % 5]);
  for (let turn = 0; turn < 26; turn++) {
    const game = await players[0].query(api.play.getGame, {code});
    const active = game.state.currentPlayer;
    await expect(players[1 - active].mutation(api.play.act, {code, action: "roll"})).rejects.toThrow();
    await players[active].mutation(api.play.act, {code, action: "roll"});
    await players[active].mutation(api.play.act, {code, action: "hold", index: 0});
    const heldDie = (await players[active].query(api.play.getGame, {code})).state.dice[0];
    await players[active].mutation(api.play.act, {code, action: "roll"});
    const rolled = (await players[active].query(api.play.getGame, {code})).state;
    expect(rolled.dice[0]).toBe(heldDie);
    const choices = rankScoreOptions(rolled.dice, rolled.players[active].scores);
    await players[active].mutation(api.play.act, {code, action: "score", index: choices[0].index});
    const [first, second] = await Promise.all(players.map(player => player.query(api.play.getGame, {code})));
    expect(first.state).toEqual(second.state);
    expect(first.state.players.flatMap(p => p.scores).filter(score => score !== null)).toHaveLength(turn + 1);
  }
  const final = await players[0].query(api.play.getGame, {code});
  expect(final.state.phase).toBe("finished");
  const leaders = await players[0].query(api.play.leaders, {});
  expect(leaders.map(entry => entry.userId).sort()).toEqual(["alice", "bob"]);
  random.mockRestore();
});

test("finished local scores get a date and can replace an undated matching import", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({subject: "alice"});
  await alice.mutation(api.play.importDevice, {name: "Alice", score: 200});
  expect((await alice.query(api.play.leaders, {}))[0].scoredAt).toBeUndefined();
  await alice.mutation(api.play.submitLocal, {name: "Alice", score: 200});
  const [record] = await alice.query(api.play.leaders, {});
  expect(record.score).toBe(200);
  expect(record.scoredAt).toBeGreaterThan(0);
  expect(record.source).toBe("local");
  await alice.mutation(api.play.submitLocal, {name: "Alice", score: 100});
  expect((await alice.query(api.play.leaders, {}))[0].score).toBe(200);
});
