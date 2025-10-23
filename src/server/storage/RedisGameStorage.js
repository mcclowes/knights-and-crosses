import { kv } from "@vercel/kv";

/**
 * Redis-backed storage for complete game state
 * Stores full game state for serverless persistence and cross-instance access
 * Acts as source of truth to avoid Vercel serverless function limitations
 */
export class RedisGameStorage {
  constructor() {
    this.GAME_KEY_PREFIX = "game:";
    this.GAME_STATE_KEY_PREFIX = "game:state:";
    this.PLAYER_STATS_KEY_PREFIX = "player:stats:";
    this.GAMES_LIST_KEY = "games:active";
    this.GAME_TTL = 3600; // 1 hour TTL for game metadata
    this.GAME_STATE_TTL = 3600; // 1 hour TTL for game state
    this.PLAYER_STATS_TTL = 86400 * 30; // 30 days for player stats
  }

  /**
   * Save game metadata to Redis
   */
  async saveGame(game) {
    const gameKey = this.GAME_KEY_PREFIX + game.id;
    const metadata = {
      id: game.id,
      hostId: game.player_host?.userid || null,
      clientId: game.player_client?.userid || null,
      playerCount: game.player_count,
      active: game.active,
      createdAt: Date.now(),
    };

    try {
      // Save game metadata with TTL
      await kv.set(gameKey, JSON.stringify(metadata), { ex: this.GAME_TTL });

      // Add to active games list
      await kv.sadd(this.GAMES_LIST_KEY, game.id);

      console.log(`Saved game ${game.id} to Redis`);
      return true;
    } catch (error) {
      console.error("Error saving game to Redis:", error);
      return false;
    }
  }

  /**
   * Get game metadata from Redis
   */
  async getGame(gameId) {
    try {
      const gameKey = this.GAME_KEY_PREFIX + gameId;
      const data = await kv.get(gameKey);

      if (!data) {
        return null;
      }

      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.error("Error getting game from Redis:", error);
      return null;
    }
  }

  /**
   * Get all active games
   */
  async getAllGames() {
    try {
      const gameIds = await kv.smembers(this.GAMES_LIST_KEY);
      const games = [];

      for (const gameId of gameIds) {
        const game = await this.getGame(gameId);
        if (game) {
          games.push(game);
        } else {
          // Clean up stale reference
          await kv.srem(this.GAMES_LIST_KEY, gameId);
        }
      }

      return games;
    } catch (error) {
      console.error("Error getting all games from Redis:", error);
      return [];
    }
  }

  /**
   * Get count of active games
   */
  async getGameCount() {
    try {
      const games = await this.getAllGames();
      return games.length;
    } catch (error) {
      console.error("Error getting game count:", error);
      return 0;
    }
  }

  /**
   * Find an available game (less than 2 players)
   */
  async findAvailableGame() {
    try {
      const games = await this.getAllGames();
      return games.find((game) => game.playerCount < 2) || null;
    } catch (error) {
      console.error("Error finding available game:", error);
      return null;
    }
  }

  /**
   * Delete game from Redis
   */
  async deleteGame(gameId) {
    try {
      const gameKey = this.GAME_KEY_PREFIX + gameId;
      await kv.del(gameKey);
      await kv.srem(this.GAMES_LIST_KEY, gameId);
      console.log(`Deleted game ${gameId} from Redis`);
      return true;
    } catch (error) {
      console.error("Error deleting game from Redis:", error);
      return false;
    }
  }

  /**
   * Update game player count
   */
  async updateGamePlayerCount(gameId, playerCount) {
    try {
      const game = await this.getGame(gameId);
      if (game) {
        game.playerCount = playerCount;
        const gameKey = this.GAME_KEY_PREFIX + gameId;
        await kv.set(gameKey, JSON.stringify(game), { ex: this.GAME_TTL });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error updating game player count:", error);
      return false;
    }
  }

  /**
   * Health check - verify Redis connection
   */
  async healthCheck() {
    try {
      await kv.set("health:check", "ok", { ex: 10 });
      const result = await kv.get("health:check");
      return result === "ok";
    } catch (error) {
      console.error("Redis health check failed:", error);
      return false;
    }
  }

  /**
   * Save complete game state to Redis
   * Includes board, players, hands, decks, and all game state
   */
  async saveGameState(gameId, gameState) {
    const stateKey = this.GAME_STATE_KEY_PREFIX + gameId;
    try {
      const serializedState = JSON.stringify(gameState);
      await kv.set(stateKey, serializedState, { ex: this.GAME_STATE_TTL });
      console.log(`Saved full game state for ${gameId} to Redis`);
      return true;
    } catch (error) {
      console.error("Error saving game state to Redis:", error);
      return false;
    }
  }

  /**
   * Get complete game state from Redis
   */
  async getGameState(gameId) {
    try {
      const stateKey = this.GAME_STATE_KEY_PREFIX + gameId;
      const data = await kv.get(stateKey);

      if (!data) {
        return null;
      }

      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.error("Error getting game state from Redis:", error);
      return null;
    }
  }

  /**
   * Delete game state from Redis
   */
  async deleteGameState(gameId) {
    try {
      const stateKey = this.GAME_STATE_KEY_PREFIX + gameId;
      await kv.del(stateKey);
      console.log(`Deleted game state ${gameId} from Redis`);
      return true;
    } catch (error) {
      console.error("Error deleting game state from Redis:", error);
      return false;
    }
  }

  /**
   * Save player statistics to Redis
   */
  async savePlayerStats(userId, stats) {
    const statsKey = this.PLAYER_STATS_KEY_PREFIX + userId;
    try {
      const serializedStats = JSON.stringify({
        ...stats,
        lastUpdated: Date.now(),
      });
      await kv.set(statsKey, serializedStats, { ex: this.PLAYER_STATS_TTL });
      console.log(`Saved player stats for ${userId} to Redis`);
      return true;
    } catch (error) {
      console.error("Error saving player stats to Redis:", error);
      return false;
    }
  }

  /**
   * Get player statistics from Redis
   */
  async getPlayerStats(userId) {
    try {
      const statsKey = this.PLAYER_STATS_KEY_PREFIX + userId;
      const data = await kv.get(statsKey);

      if (!data) {
        // Return default stats if player is new
        return {
          userId: userId,
          totalGames: 0,
          wins: 0,
          losses: 0,
          mmr: 1000,
          lastUpdated: Date.now(),
        };
      }

      return typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.error("Error getting player stats from Redis:", error);
      // Return default stats on error
      return {
        userId: userId,
        totalGames: 0,
        wins: 0,
        losses: 0,
        mmr: 1000,
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Update player statistics after a game
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
      console.error("Error updating player stats:", error);
      return null;
    }
  }
}
