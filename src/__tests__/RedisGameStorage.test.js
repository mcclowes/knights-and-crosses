import { describe, it, expect, beforeEach } from "@jest/globals";
import { RedisGameStorage } from "../server/storage/RedisGameStorage.js";

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  log: () => {},
};

/**
 * In-memory Redis double covering the subset of commands RedisGameStorage uses.
 */
class FakeRedis {
  constructor() {
    this.kv = new Map();
    this.sets = new Map();
  }
  async set(key, value) {
    this.kv.set(key, value);
    return "OK";
  }
  async get(key) {
    return this.kv.has(key) ? this.kv.get(key) : null;
  }
  async del(key) {
    this.kv.delete(key);
    return 1;
  }
  async sAdd(key, member) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key).add(member);
    return 1;
  }
  async sRem(key, member) {
    this.sets.get(key)?.delete(member);
    return 1;
  }
  async sMembers(key) {
    return Array.from(this.sets.get(key) || []);
  }
  async quit() {
    return "OK";
  }
}

function makeStorage() {
  const storage = new RedisGameStorage(silentLogger);
  storage.client = new FakeRedis();
  storage.connected = true; // bypass connect()
  return storage;
}

function fakeGame(id, playerCount = 1) {
  return {
    id,
    player_host: { userid: "host" },
    player_client: playerCount > 1 ? { userid: "client" } : null,
    player_count: playerCount,
    active: playerCount > 1,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
}

describe("RedisGameStorage", () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
  });

  it("saves and retrieves game metadata", async () => {
    await storage.saveGame(fakeGame("g1"));
    const loaded = await storage.getGame("g1");
    expect(loaded.id).toBe("g1");
    expect(loaded.hostId).toBe("host");
    expect(loaded.playerCount).toBe(1);
  });

  it("returns null for a missing game", async () => {
    expect(await storage.getGame("nope")).toBeNull();
  });

  it("lists all active games and finds an available one", async () => {
    await storage.saveGame(fakeGame("g1", 1));
    await storage.saveGame(fakeGame("g2", 2));

    const all = await storage.getAllGames();
    expect(all.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect(await storage.getGameCount()).toBe(2);

    const available = await storage.findAvailableGame();
    expect(available.id).toBe("g1"); // only g1 has < 2 players
  });

  it("prunes stale set references when metadata is gone", async () => {
    await storage.saveGame(fakeGame("g1"));
    await storage.client.del("game:g1"); // metadata vanished, set ref remains
    const all = await storage.getAllGames();
    expect(all).toEqual([]);
    expect(await storage.client.sMembers("games:active")).toEqual([]);
  });

  it("deletes a game and its set reference", async () => {
    await storage.saveGame(fakeGame("g1"));
    await storage.deleteGame("g1");
    expect(await storage.getGame("g1")).toBeNull();
    expect(await storage.client.sMembers("games:active")).toEqual([]);
  });

  it("saves and retrieves full game state", async () => {
    const state = { board: { results: [[1]] }, turn: 1 };
    await storage.saveGameState("g1", state);
    expect(await storage.getGameState("g1")).toEqual(state);
    await storage.deleteGameState("g1");
    expect(await storage.getGameState("g1")).toBeNull();
  });

  it("updates game activity timestamp", async () => {
    await storage.saveGame(fakeGame("g1"));
    const before = (await storage.getGame("g1")).lastActivity;
    await new Promise((r) => setTimeout(r, 5));
    await storage.updateGameActivity("g1");
    const after = (await storage.getGame("g1")).lastActivity;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("finds inactive games by threshold", async () => {
    await storage.saveGame(fakeGame("g1"));
    // Negative threshold -> everything counts as inactive.
    const inactive = await storage.getInactiveGames(-1000);
    expect(inactive.map((g) => g.id)).toContain("g1");
    // Huge threshold -> nothing is inactive.
    expect(await storage.getInactiveGames(60 * 60 * 1000)).toEqual([]);
  });

  describe("player stats", () => {
    it("returns default stats for an unknown player", async () => {
      const stats = await storage.getPlayerStats("newbie");
      expect(stats).toMatchObject({ mmr: 1000, wins: 0, losses: 0, totalGames: 0 });
    });

    it("records a win: increments totalGames/wins and adjusts mmr", async () => {
      const updated = await storage.updatePlayerStats("p1", 12, true);
      expect(updated).toMatchObject({ mmr: 1012, wins: 1, losses: 0, totalGames: 1 });
      const reloaded = await storage.getPlayerStats("p1");
      expect(reloaded.mmr).toBe(1012);
    });

    it("records a loss with a negative mmr delta", async () => {
      const updated = await storage.updatePlayerStats("p2", -8, false);
      expect(updated).toMatchObject({ mmr: 992, wins: 0, losses: 1, totalGames: 1 });
    });
  });

  it("healthCheck round-trips a probe key", async () => {
    expect(await storage.healthCheck()).toBe(true);
  });

  it("disconnect closes the client", async () => {
    await storage.disconnect();
    expect(storage.client).toBeNull();
    expect(storage.connected).toBe(false);
  });
});
