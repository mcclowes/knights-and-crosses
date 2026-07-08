import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { GameService } from "../server/services/GameService.js";
import { Game } from "../server/models/Game.js";

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  log: () => {},
};

function fakeSocket(userid) {
  return { userid, playername: userid, send: jest.fn(), game: null };
}

/**
 * Minimal in-memory storage double implementing only what GameService calls.
 */
class FakeStorage {
  constructor() {
    this.stats = new Map();
    this.deletedGames = [];
    this.updatePlayerStats = jest.fn(async (userId, mmrChange, won) => {
      const prev = this.stats.get(userId) || {
        mmr: 1000,
        wins: 0,
        losses: 0,
        totalGames: 0,
      };
      const next = {
        mmr: prev.mmr + mmrChange,
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
        totalGames: prev.totalGames + 1,
      };
      this.stats.set(userId, next);
      return next;
    });
  }
  async getGameCount() {
    return 0;
  }
  async getPlayerStats(userId) {
    return this.stats.get(userId) || { mmr: 1000, totalGames: 0 };
  }
  async saveGame() {}
  async saveGameState() {}
  async updateGameActivity() {}
  async deleteGame(id) {
    this.deletedGames.push(id);
  }
  async deleteGameState() {}
  async getInactiveGames() {
    return [];
  }
}

function wonGamecore(win) {
  return {
    win,
    players: {
      self: { mmrChange: 16.5 },
      other: { mmrChange: -16.5 },
    },
    stopUpdate: () => {},
  };
}

describe("GameService", () => {
  let service;
  let storage;

  beforeEach(() => {
    storage = new FakeStorage();
    service = new GameService(silentLogger, storage);
    // Don't re-queue players into fresh games (would spin up the real engine).
    service.findGame = jest.fn().mockResolvedValue(undefined);
  });

  describe("winGame (server-authoritative)", () => {
    it("ignores a win request when the engine recorded no winner (spoofed 'w')", async () => {
      const host = fakeSocket("host");
      const client = fakeSocket("client");
      const game = {
        id: "g1",
        player_host: host,
        player_client: client,
        player_count: 2,
        stop: jest.fn(),
        gamecore: wonGamecore(undefined), // no win recorded
      };
      service.games["g1"] = game;
      service.game_count = 1;

      await service.winGame("g1");

      expect(game.stop).not.toHaveBeenCalled();
      expect(storage.updatePlayerStats).not.toHaveBeenCalled();
      expect(host.send).not.toHaveBeenCalled();
      expect(client.send).not.toHaveBeenCalled();
      expect(service.games["g1"]).toBe(game); // still present
    });

    it("records the host as winner and the client as loser when win === 1", async () => {
      const host = fakeSocket("host");
      const client = fakeSocket("client");
      service.games["g1"] = {
        id: "g1",
        player_host: host,
        player_client: client,
        player_count: 2,
        stop: jest.fn(),
        gamecore: wonGamecore(1),
      };
      service.game_count = 1;

      await service.winGame("g1");

      expect(storage.updatePlayerStats).toHaveBeenCalledWith("host", 16.5, true);
      expect(storage.updatePlayerStats).toHaveBeenCalledWith(
        "client",
        -16.5,
        false,
      );
      expect(host.send).toHaveBeenCalledWith("s.e");
      expect(client.send).toHaveBeenCalledWith("s.e");
      expect(service.games["g1"]).toBeUndefined();
      expect(storage.deletedGames).toContain("g1");
    });

    it("records the client as winner when win === -1", async () => {
      const host = fakeSocket("host");
      const client = fakeSocket("client");
      service.games["g1"] = {
        id: "g1",
        player_host: host,
        player_client: client,
        player_count: 2,
        stop: jest.fn(),
        gamecore: wonGamecore(-1),
      };
      service.game_count = 1;

      await service.winGame("g1");

      expect(storage.updatePlayerStats).toHaveBeenCalledWith("host", 16.5, false);
      expect(storage.updatePlayerStats).toHaveBeenCalledWith(
        "client",
        -16.5,
        true,
      );
    });

    it("does nothing for an unknown game id", async () => {
      await expect(service.winGame("missing")).resolves.toBeUndefined();
      expect(storage.updatePlayerStats).not.toHaveBeenCalled();
    });
  });

  describe("endGame", () => {
    it("notifies and re-queues the remaining player", async () => {
      const host = fakeSocket("host");
      const client = fakeSocket("client");
      const game = new Game(host, silentLogger);
      game.player_client = client;
      game.player_count = 2;
      game.gamecore = { stopUpdate: () => {} };
      service.games[game.id] = game;
      service.game_count = 1;

      await service.endGame(game.id, "host");

      expect(client.send).toHaveBeenCalledWith("s.e");
      expect(service.findGame).toHaveBeenCalledWith(client);
      expect(service.games[game.id]).toBeUndefined();
      expect(service.game_count).toBe(0);
    });

    it("is a no-op for an unknown game", async () => {
      await expect(service.endGame("missing", "x")).resolves.toBeUndefined();
    });
  });

  describe("cleanupInactiveGames", () => {
    it("removes games past the inactivity threshold and notifies players", async () => {
      const host = fakeSocket("host");
      const game = new Game(host, silentLogger);
      game.gamecore = { stopUpdate: () => {} };
      game.lastActivity = Date.now() - service.INACTIVITY_THRESHOLD - 1000;
      service.games[game.id] = game;
      service.game_count = 1;

      const cleaned = await service.cleanupInactiveGames();

      expect(cleaned).toBe(1);
      expect(host.send).toHaveBeenCalledWith("s.e");
      expect(service.games[game.id]).toBeUndefined();
    });

    it("keeps recently-active games", async () => {
      const host = fakeSocket("host");
      const game = new Game(host, silentLogger);
      game.gamecore = { stopUpdate: () => {} };
      game.lastActivity = Date.now();
      service.games[game.id] = game;
      service.game_count = 1;

      const cleaned = await service.cleanupInactiveGames();

      expect(cleaned).toBe(0);
      expect(service.games[game.id]).toBe(game);
    });
  });

  describe("cleanup interval lifecycle", () => {
    it("starts and stops without leaking a timer", () => {
      service.startCleanupInterval();
      expect(service.cleanupInterval).not.toBeNull();
      service.stopCleanupInterval();
      expect(service.cleanupInterval).toBeNull();
    });
  });
});
