import { Game } from "../models/Game.js";
import game_core from "../../game.core.server.js";
import { logger as defaultLogger } from "../utils/logger.js";

export class GameService {
  constructor(logger = defaultLogger, storage = null) {
    this.games = {}; // Ephemeral cache for active socket connections only
    this.game_count = 0;
    this.logger = logger || defaultLogger;
    this.storage = storage; // Redis storage - source of truth when configured
    this.cleanupInterval = null;
    this.CLEANUP_INTERVAL = 60 * 1000; // Check every 60 seconds
    this.INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes of inactivity
  }

  /**
   * Initialize service - sync with Redis if available.
   */
  async initialize() {
    if (this.storage) {
      try {
        const redisCount = await this.storage.getGameCount();
        this.logger.info(
          `[GameService] Initialized (Redis-backed). ${redisCount} active game(s) in Redis.`,
        );
      } catch (error) {
        this.logger.error("Error initializing GameService with Redis:", error);
      }
    } else {
      this.logger.info("[GameService] Initialized in memory-only mode (Redis not configured).");
    }

    this.startCleanupInterval();
  }

  /**
   * Start the periodic cleanup interval for inactive games.
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      return;
    }

    this.logger.debug(
      `[GameService] Starting inactive game cleanup (interval: ${this.CLEANUP_INTERVAL / 1000}s, threshold: ${this.INACTIVITY_THRESHOLD / 1000}s)`,
    );

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveGames().catch((error) =>
        this.logger.error("[GameService] Cleanup error:", error),
      );
    }, this.CLEANUP_INTERVAL);
    // Don't let the cleanup timer keep the process (or a Jest worker) alive.
    this.cleanupInterval.unref?.();
  }

  /**
   * Stop the cleanup interval.
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.debug("[GameService] Stopped inactive game cleanup");
    }
  }

  /**
   * Clean up inactive games from memory and storage.
   */
  async cleanupInactiveGames() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [gameId, game] of Object.entries(this.games)) {
      const lastActivity = game.lastActivity || game.createdAt || 0;
      if (now - lastActivity > this.INACTIVITY_THRESHOLD) {
        this.logger.debug(
          `[GameService] Cleaning up inactive game ${gameId} (inactive ${Math.round((now - lastActivity) / 1000)}s)`,
        );

        // Notify players that the game is ending due to inactivity.
        for (const player of [game.player_host, game.player_client]) {
          try {
            player?.send?.("s.e");
          } catch {
            // Player may already be disconnected.
          }
        }

        game.stop();
        delete this.games[gameId];
        this.game_count--;

        if (this.storage) {
          await this.storage.deleteGame(gameId);
          await this.storage.deleteGameState(gameId);
        }

        cleanedCount++;
      }
    }

    // Also clean up stale games in Redis that aren't in memory (crashed
    // instances, restarts, cold starts).
    if (this.storage) {
      try {
        const inactiveRedisGames = await this.storage.getInactiveGames(
          this.INACTIVITY_THRESHOLD,
        );
        for (const gameMetadata of inactiveRedisGames) {
          if (!this.games[gameMetadata.id]) {
            this.logger.debug(
              `[GameService] Cleaning up stale Redis game ${gameMetadata.id}`,
            );
            await this.storage.deleteGame(gameMetadata.id);
            await this.storage.deleteGameState(gameMetadata.id);
            cleanedCount++;
          }
        }
      } catch (error) {
        this.logger.error("[GameService] Error cleaning up Redis games:", error);
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `[GameService] Cleaned up ${cleanedCount} inactive game(s). Remaining: ${this.game_count}`,
      );
    }
    return cleanedCount;
  }

  /**
   * Update activity for a game. Called when a game receives player input.
   */
  async updateGameActivity(gameId) {
    const game = this.games[gameId];
    if (game) {
      game.updateActivity();
      if (this.storage) {
        await this.storage.updateGameActivity(gameId);
      }
    }
  }

  /**
   * Save complete game state to Redis. Called after any game state mutation.
   */
  async saveGameToKV(game) {
    if (!this.storage || !game.gamecore) {
      return false;
    }

    try {
      await this.storage.saveGame(game);
      const gameState = game.gamecore.serializeState();
      await this.storage.saveGameState(game.id, gameState);
      return true;
    } catch (error) {
      this.logger.error("[GameService] Error saving game to Redis:", error);
      return false;
    }
  }

  async createGame(player) {
    this.logger.debug("[GameService] Creating new game");
    const game = new Game(player, this.logger);
    this.games[game.id] = game;
    this.game_count++;

    game.gamecore = new game_core(game, this.storage);
    game.gamecore.update(Date.now());

    // Load player stats from Redis and apply MMR (server-authoritative).
    if (this.storage && player.userid) {
      const stats = await this.storage.getPlayerStats(player.userid);
      game.gamecore.players.self.mmr = stats.mmr || 1000;
      this.logger.debug(
        `[GameService] Loaded host stats: MMR=${stats.mmr}, Games=${stats.totalGames}`,
      );
    }

    // Ping player as host.
    player.send("s.h." + String(game.gamecore.local_time).replace(".", "-"));
    player.game = game;
    player.hosting = true;

    await this.saveGameToKV(game);
    this.logger.debug(`[GameService] Created game ${game.id}`);
    return game;
  }

  async findGame(player) {
    this.logger.debug(
      `[GameService] Finding a game for ${player.userid} (${player.playername}). In-memory: ${this.game_count}`,
    );

    // Join an existing in-memory game with an open slot.
    //
    // NOTE: matchmaking is intentionally in-memory only. Two players must be on
    // the same instance to exchange messages, because games hold raw socket
    // references. Cross-instance matchmaking requires the Redis adapter + a
    // shared matchmaking queue (see DEPLOYMENT.md "Path to horizontal scaling").
    for (const game of Object.values(this.games)) {
      if (game.player_count < 2 && game.player_host && game.gamecore) {
        this.logger.debug(`[GameService] Adding player to game ${game.id}`);

        if (this.storage && player.userid) {
          const stats = await this.storage.getPlayerStats(player.userid);
          game.gamecore.players.other.mmr = stats.mmr || 1000;
        }

        game.addClient(player);
        await this.saveGameToKV(game);
        return game;
      }
    }

    this.logger.debug("[GameService] No open games; creating a new one");
    return await this.createGame(player);
  }

  async endGame(gameId, userId) {
    const game = this.games[gameId];
    if (!game) {
      this.logger.debug(`[GameService] endGame: game ${gameId} not found`);
      return;
    }

    game.stop();

    if (game.player_count > 1) {
      const otherPlayer = game.getOtherPlayer(userId);
      if (otherPlayer) {
        otherPlayer.send("s.e");
        await this.findGame(otherPlayer);
      }
    }

    delete this.games[gameId];
    this.game_count--;
    this.logger.debug(`[GameService] Game ${gameId} removed. ${this.game_count} remaining`);

    if (this.storage) {
      await this.storage.deleteGame(gameId);
      await this.storage.deleteGameState(gameId);
    }
  }

  /**
   * End a won game. The winner is decided server-side by the game engine
   * (game.gamecore.win: 1 = host, -1 = client). A client 'w' message can only
   * request settlement of an already-decided game; it can never declare a win.
   */
  async winGame(gameId) {
    const game = this.games[gameId];
    if (!game) {
      this.logger.debug(`[GameService] winGame: game ${gameId} not found`);
      return;
    }

    const winner = game.gamecore?.win;
    if (winner !== 1 && winner !== -1) {
      this.logger.warn(
        `[GameService] Ignoring win for ${gameId}: no server-recorded winner (possible spoofed 'w').`,
      );
      return;
    }

    game.stop();

    // Update player statistics in Redis using the server-decided winner.
    if (this.storage && game.player_host && game.player_client) {
      const hostWon = winner === 1;
      const hostMmrChange = game.gamecore?.players?.self?.mmrChange || 0;
      const clientMmrChange = game.gamecore?.players?.other?.mmrChange || 0;

      await this.storage.updatePlayerStats(
        game.player_host.userid,
        hostMmrChange,
        hostWon,
      );
      await this.storage.updatePlayerStats(
        game.player_client.userid,
        clientMmrChange,
        !hostWon,
      );
    }

    if (game.player_client) {
      game.player_client.send("s.e");
      await this.findGame(game.player_client);
    }
    if (game.player_host) {
      game.player_host.send("s.e");
      game.player_host.hosting = false;
      await this.findGame(game.player_host);
    }

    delete this.games[gameId];
    this.game_count--;
    this.logger.debug(`[GameService] Game ${gameId} won and removed. ${this.game_count} remaining`);

    if (this.storage) {
      await this.storage.deleteGame(gameId);
      await this.storage.deleteGameState(gameId);
    }
  }
}
