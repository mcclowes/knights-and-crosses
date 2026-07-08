import { createClient } from "redis";
import { logger as defaultLogger } from "../utils/logger.js";

/**
 * Redis-backed storage for complete game state.
 * Stores full game state for persistence and cross-instance access; acts as the
 * source of truth so games survive restarts.
 */
export class RedisGameStorage {
  constructor(logger = defaultLogger) {
    this.logger = logger;
    this.GAME_KEY_PREFIX = "game:";
    this.GAME_STATE_KEY_PREFIX = "game:state:";
    this.PLAYER_STATS_KEY_PREFIX = "player:stats:";
    this.GAMES_LIST_KEY = "games:active";
    this.GAME_TTL = 3600; // 1 hour TTL for game metadata
    this.GAME_STATE_TTL = 3600; // 1 hour TTL for game state
    this.PLAYER_STATS_TTL = 86400 * 30; // 30 days for player stats
    this.INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes before cleanup
    this.client = null;
    this.connected = false;
    this._connecting = null; // in-flight connect promise (dedupes concurrent connects)
  }

  /**
   * Initialize Redis connection.
   * Uses KV_URL environment variable from the Vercel marketplace integration.
   */
  async connect() {
    if (this.connected && this.client) {
      return this.client;
    }
    if (this._connecting) {
      return this._connecting;
    }

    this._connecting = (async () => {
      try {
        this.client = createClient({
          url: process.env.KV_URL,
          socket: {
            // Bounded reconnect backoff instead of retrying forever tightly.
            reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
          },
        });

        this.client.on("error", (err) => {
          this.logger.error("Redis Client Error:", err);
          this.connected = false;
        });
        this.client.on("connect", () => {
          this.logger.info("Redis client connected successfully");
          this.connected = true;
        });
        this.client.on("end", () => {
          this.connected = false;
        });

        await this.client.connect();
        return this.client;
      } catch (error) {
        this.logger.error("Failed to connect to Redis:", error);
        this.client = null;
        throw error;
      } finally {
        this._connecting = null;
      }
    })();

    return this._connecting;
  }

  /**
   * Ensure Redis is connected before operations.
   */
  async ensureConnected() {
    if (!this.connected || !this.client) {
      await this.connect();
    }
  }

  /**
   * Close the Redis connection (graceful shutdown).
   */
  async disconnect() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        this.logger.error("Error closing Redis connection:", error);
      } finally {
        this.client = null;
        this.connected = false;
      }
    }
  }

  /**
   * Save game metadata to Redis.
   */
  async saveGame(game) {
    await this.ensureConnected();
    const gameKey = this.GAME_KEY_PREFIX + game.id;
    const now = Date.now();
    const metadata = {
      id: game.id,
      hostId: game.player_host?.userid || null,
      clientId: game.player_client?.userid || null,
      playerCount: game.player_count,
      active: game.active,
      createdAt: game.createdAt || now,
      lastActivity: game.lastActivity || now,
    };

    try {
      await this.client.set(gameKey, JSON.stringify(metadata), {
        EX: this.GAME_TTL,
      });
      await this.client.sAdd(this.GAMES_LIST_KEY, game.id);
      this.logger.debug(`Saved game ${game.id} to Redis`);
      return true;
    } catch (error) {
      this.logger.error("Error saving game to Redis:", error);
      return false;
    }
  }

  /**
   * Get game metadata from Redis.
   */
  async getGame(gameId) {
    await this.ensureConnected();
    try {
      const gameKey = this.GAME_KEY_PREFIX + gameId;
      const data = await this.client.get(gameKey);
      if (!data) return null;
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      this.logger.error("Error getting game from Redis:", error);
      return null;
    }
  }

  /**
   * Get all active games.
   */
  async getAllGames() {
    await this.ensureConnected();
    try {
      const gameIds = await this.client.sMembers(this.GAMES_LIST_KEY);
      const games = [];
      for (const gameId of gameIds) {
        const game = await this.getGame(gameId);
        if (game) {
          games.push(game);
        } else {
          // Clean up stale reference
          await this.client.sRem(this.GAMES_LIST_KEY, gameId);
        }
      }
      return games;
    } catch (error) {
      this.logger.error("Error getting all games from Redis:", error);
      return [];
    }
  }

  /**
   * Get count of active games.
   */
  async getGameCount() {
    try {
      const games = await this.getAllGames();
      return games.length;
    } catch (error) {
      this.logger.error("Error getting game count:", error);
      return 0;
    }
  }

  /**
   * Find an available game (less than 2 players).
   */
  async findAvailableGame() {
    try {
      const games = await this.getAllGames();
      return games.find((game) => game.playerCount < 2) || null;
    } catch (error) {
      this.logger.error("Error finding available game:", error);
      return null;
    }
  }

  /**
   * Delete game from Redis.
   */
  async deleteGame(gameId) {
    await this.ensureConnected();
    try {
      const gameKey = this.GAME_KEY_PREFIX + gameId;
      await this.client.del(gameKey);
      await this.client.sRem(this.GAMES_LIST_KEY, gameId);
      this.logger.debug(`Deleted game ${gameId} from Redis`);
      return true;
    } catch (error) {
      this.logger.error("Error deleting game from Redis:", error);
      return false;
    }
  }

  /**
   * Update game activity timestamp.
   */
  async updateGameActivity(gameId) {
    await this.ensureConnected();
    try {
      const game = await this.getGame(gameId);
      if (game) {
        game.lastActivity = Date.now();
        const gameKey = this.GAME_KEY_PREFIX + gameId;
        await this.client.set(gameKey, JSON.stringify(game), {
          EX: this.GAME_TTL,
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error("Error updating game activity:", error);
      return false;
    }
  }

  /**
   * Get all inactive games (no activity for longer than threshold).
   * @param {number} threshold - Inactivity threshold in milliseconds.
   * @returns {Array} Array of inactive game metadata objects.
   */
  async getInactiveGames(threshold = null) {
    const inactivityThreshold = threshold || this.INACTIVITY_THRESHOLD;
    const now = Date.now();

    try {
      const allGames = await this.getAllGames();
      return allGames.filter((game) => {
        const lastActivity = game.lastActivity || game.createdAt || 0;
        return now - lastActivity > inactivityThreshold;
      });
    } catch (error) {
      this.logger.error("Error getting inactive games:", error);
      return [];
    }
  }

  /**
   * Update game player count.
   */
  async updateGamePlayerCount(gameId, playerCount) {
    await this.ensureConnected();
    try {
      const game = await this.getGame(gameId);
      if (game) {
        game.playerCount = playerCount;
        const gameKey = this.GAME_KEY_PREFIX + gameId;
        await this.client.set(gameKey, JSON.stringify(game), {
          EX: this.GAME_TTL,
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error("Error updating game player count:", error);
      return false;
    }
  }

  /**
   * Health check - verify Redis connection.
   */
  async healthCheck() {
    await this.ensureConnected();
    try {
      await this.client.set("health:check", "ok", { EX: 10 });
      const result = await this.client.get("health:check");
      return result === "ok";
    } catch (error) {
      this.logger.error("Redis health check failed:", error);
      return false;
    }
  }

  /**
   * Save complete game state to Redis (board, players, hands, decks, ...).
   */
  async saveGameState(gameId, gameState) {
    await this.ensureConnected();
    const stateKey = this.GAME_STATE_KEY_PREFIX + gameId;
    try {
      await this.client.set(stateKey, JSON.stringify(gameState), {
        EX: this.GAME_STATE_TTL,
      });
      this.logger.debug(`Saved full game state for ${gameId} to Redis`);
      return true;
    } catch (error) {
      this.logger.error("Error saving game state to Redis:", error);
      return false;
    }
  }

  /**
   * Get complete game state from Redis.
   */
  async getGameState(gameId) {
    await this.ensureConnected();
    try {
      const stateKey = this.GAME_STATE_KEY_PREFIX + gameId;
      const data = await this.client.get(stateKey);
      if (!data) return null;
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      this.logger.error("Error getting game state from Redis:", error);
      return null;
    }
  }

  /**
   * Delete game state from Redis.
   */
  async deleteGameState(gameId) {
    await this.ensureConnected();
    try {
      const stateKey = this.GAME_STATE_KEY_PREFIX + gameId;
      await this.client.del(stateKey);
      this.logger.debug(`Deleted game state ${gameId} from Redis`);
      return true;
    } catch (error) {
      this.logger.error("Error deleting game state from Redis:", error);
      return false;
    }
  }

  /**
   * Save player statistics to Redis.
   */
  async savePlayerStats(userId, stats) {
    await this.ensureConnected();
    const statsKey = this.PLAYER_STATS_KEY_PREFIX + userId;
    try {
      await this.client.set(
        statsKey,
        JSON.stringify({ ...stats, lastUpdated: Date.now() }),
        { EX: this.PLAYER_STATS_TTL },
      );
      this.logger.debug(`Saved player stats for ${userId} to Redis`);
      return true;
    } catch (error) {
      this.logger.error("Error saving player stats to Redis:", error);
      return false;
    }
  }

  /**
   * Get player statistics from Redis (defaults for new/unknown players).
   */
  async getPlayerStats(userId) {
    await this.ensureConnected();
    try {
      const statsKey = this.PLAYER_STATS_KEY_PREFIX + userId;
      const data = await this.client.get(statsKey);
      if (!data) {
        return this._defaultStats(userId);
      }
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      this.logger.error("Error getting player stats from Redis:", error);
      return this._defaultStats(userId);
    }
  }

  _defaultStats(userId) {
    return {
      userId,
      totalGames: 0,
      wins: 0,
      losses: 0,
      mmr: 1000,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Update player statistics after a game.
   */
  async updatePlayerStats(userId, mmrChange, won) {
    try {
      const stats = await this.getPlayerStats(userId);
      stats.totalGames = (stats.totalGames || 0) + 1;
      stats.wins = (stats.wins || 0) + (won ? 1 : 0);
      stats.losses = (stats.losses || 0) + (won ? 0 : 1);
      stats.mmr = (stats.mmr || 1000) + mmrChange;
      await this.savePlayerStats(userId, stats);
      return stats;
    } catch (error) {
      this.logger.error("Error updating player stats:", error);
      return null;
    }
  }
}
