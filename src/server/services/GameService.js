import { Game } from "../models/Game.js";
import game_core from "../../game.core.server.js";

export class GameService {
  constructor(logger = null, storage = null) {
    this.games = {}; // Ephemeral cache for active socket connections only
    this.game_count = 0;
    this.logger = logger;
    this.storage = storage; // KV storage - source of truth for serverless
    this.cleanupInterval = null;
    this.CLEANUP_INTERVAL = 60 * 1000; // Check every 60 seconds
    this.INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes of inactivity
  }

  /**
   * Initialize service - sync with KV if available
   * In serverless mode, games are loaded on-demand from KV
   */
  async initialize() {
    if (this.storage) {
      try {
        const redisCount = await this.storage.getGameCount();
        console.log(
          `GameService initialized. KV reports ${redisCount} active games.`,
        );
        console.log(
          "[GameService] Running in KV-first mode for serverless persistence",
        );
      } catch (error) {
        console.error("Error initializing GameService with KV:", error);
      }
    } else {
      console.log(
        "[GameService] Running in memory-only mode (KV not configured)",
      );
    }

    // Start the cleanup interval for inactive games
    this.startCleanupInterval();
  }

  /**
   * Start the periodic cleanup interval for inactive games
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      return; // Already running
    }

    console.log(
      `[GameService] Starting inactive game cleanup (interval: ${this.CLEANUP_INTERVAL / 1000}s, threshold: ${this.INACTIVITY_THRESHOLD / 1000}s)`,
    );

    this.cleanupInterval = setInterval(async () => {
      await this.cleanupInactiveGames();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("[GameService] Stopped inactive game cleanup");
    }
  }

  /**
   * Clean up inactive games from memory and storage
   * Games are considered inactive if they haven't received any activity
   * for longer than INACTIVITY_THRESHOLD
   */
  async cleanupInactiveGames() {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up in-memory games
    for (const [gameId, game] of Object.entries(this.games)) {
      const lastActivity = game.lastActivity || game.createdAt || 0;
      if (now - lastActivity > this.INACTIVITY_THRESHOLD) {
        console.log(
          `[GameService] Cleaning up inactive game ${gameId} (inactive for ${Math.round((now - lastActivity) / 1000)}s)`,
        );

        // Notify players that the game is ending due to inactivity
        if (game.player_host) {
          try {
            game.player_host.send("s.e");
          } catch (e) {
            // Player may already be disconnected
          }
        }
        if (game.player_client) {
          try {
            game.player_client.send("s.e");
          } catch (e) {
            // Player may already be disconnected
          }
        }

        // Stop the game
        game.stop();

        // Remove from memory
        delete this.games[gameId];
        this.game_count--;

        // Remove from storage
        if (this.storage) {
          await this.storage.deleteGame(gameId);
          await this.storage.deleteGameState(gameId);
        }

        cleanedCount++;
      }
    }

    // Also clean up stale games in Redis that aren't in memory
    // (e.g., from crashed instances or serverless cold starts)
    if (this.storage) {
      try {
        const inactiveRedisGames = await this.storage.getInactiveGames(
          this.INACTIVITY_THRESHOLD,
        );
        for (const gameMetadata of inactiveRedisGames) {
          // Skip if we already cleaned it up from memory
          if (!this.games[gameMetadata.id]) {
            console.log(
              `[GameService] Cleaning up stale Redis game ${gameMetadata.id}`,
            );
            await this.storage.deleteGame(gameMetadata.id);
            await this.storage.deleteGameState(gameMetadata.id);
            cleanedCount++;
          }
        }
      } catch (error) {
        console.error("[GameService] Error cleaning up Redis games:", error);
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[GameService] Cleaned up ${cleanedCount} inactive game(s). Remaining: ${this.game_count}`,
      );
    }
  }

  /**
   * Update activity for a game
   * Called when a game receives player input
   */
  async updateGameActivity(gameId) {
    const game = this.games[gameId];
    if (game) {
      game.updateActivity();

      // Also update in Redis storage
      if (this.storage) {
        await this.storage.updateGameActivity(gameId);
      }
    }
  }

  /**
   * Load a game from KV storage and restore it to memory
   * Used for cross-instance access and recovery
   */
  async loadGameFromKV(gameId, hostSocket = null, clientSocket = null) {
    if (!this.storage) {
      return null;
    }

    try {
      // Load metadata and state from KV
      const metadata = await this.storage.getGame(gameId);
      const state = await this.storage.getGameState(gameId);

      if (!metadata || !state) {
        console.log(`[GameService] Game ${gameId} not found in KV`);
        return null;
      }

      console.log(`[GameService] Restoring game ${gameId} from KV`);

      // Create Game instance with host socket
      const game = new Game(hostSocket, this.logger);
      game.id = gameId;
      game.player_count = metadata.playerCount;
      game.active = metadata.active;

      // Initialize game core with storage
      game.gamecore = new game_core(game, this.storage);

      // Restore game state
      game.gamecore.deserializeState(state);

      // Reconnect sockets if provided
      if (hostSocket) {
        game.player_host = hostSocket;
        game.gamecore.players.self.instance = hostSocket;
        hostSocket.game = game;
        hostSocket.hosting = true;
      }

      if (clientSocket) {
        game.player_client = clientSocket;
        game.gamecore.players.other.instance = clientSocket;
        clientSocket.game = game;
      }

      // Restart game update loop if game is active
      if (game.active) {
        game.gamecore.update(new Date().getTime());
      }

      // Add to memory cache
      this.games[gameId] = game;
      this.game_count = Object.keys(this.games).length;

      console.log(`[GameService] Game ${gameId} restored successfully from KV`);
      return game;
    } catch (error) {
      console.error(`[GameService] Error loading game from KV:`, error);
      return null;
    }
  }

  /**
   * Save complete game state to KV
   * Called after any game state mutation
   */
  async saveGameToKV(game) {
    if (!this.storage || !game.gamecore) {
      return false;
    }

    try {
      // Save metadata
      await this.storage.saveGame(game);

      // Save full game state
      const gameState = game.gamecore.serializeState();
      await this.storage.saveGameState(game.id, gameState);

      return true;
    } catch (error) {
      console.error("[GameService] Error saving game to KV:", error);
      return false;
    }
  }

  async createGame(player) {
    console.log("[GameService] Creating new game");
    const game = new Game(player, this.logger);
    this.games[game.id] = game;
    this.game_count++;

    game.gamecore = new game_core(game, this.storage);
    game.gamecore.update(new Date().getTime());

    // Load player stats from KV and apply MMR
    if (this.storage && player.userid) {
      const stats = await this.storage.getPlayerStats(player.userid);
      game.gamecore.players.self.mmr = stats.mmr || 1000;
      console.log(
        `[GameService] Loaded host player stats: MMR=${stats.mmr}, Games=${stats.totalGames}`,
      );
    }

    // Ping player as host
    player.send("s.h." + String(game.gamecore.local_time).replace(".", "-"));
    console.log("[GameService] Server host at " + game.gamecore.local_time);
    player.game = game;
    player.hosting = true;

    // Persist complete game state to KV (source of truth for serverless)
    await this.saveGameToKV(game);

    console.log(`[GameService] Created game ${game.id} and saved to KV`);
    return game;
  }

  async findGame(player) {
    console.log(
      `[GameService] Looking for a game. In-memory: ${this.game_count}`,
    );
    console.log(
      "[GameService] Player connecting:",
      player.userid,
      player.playername,
    );

    // First check in-memory games (fast path)
    for (const game of Object.values(this.games)) {
      if (game.player_count < 2) {
        console.log(
          `[GameService] Adding player to existing in-memory game: ${game.id}`,
        );

        // Load player stats from KV and apply MMR before adding client
        if (this.storage && player.userid) {
          const stats = await this.storage.getPlayerStats(player.userid);
          // The client will be assigned to players.other, so set their MMR
          game.gamecore.players.other.mmr = stats.mmr || 1000;
          console.log(
            `[GameService] Loaded client player stats: MMR=${stats.mmr}, Games=${stats.totalGames}`,
          );
        }

        game.addClient(player);

        // Persist updated state to KV
        await this.saveGameToKV(game);

        return game;
      }
    }

    // Check KV for games from other instances or previous invocations (serverless recovery)
    if (this.storage) {
      const availableGame = await this.storage.findAvailableGame();
      if (availableGame) {
        console.log(
          `[GameService] Found available game in KV: ${availableGame.id}`,
        );
        console.log(
          "[GameService] Restoring game from KV for cross-instance/recovery",
        );

        // Restore the game from KV with the new player as client
        const game = await this.loadGameFromKV(availableGame.id, null, player);

        if (game) {
          // Load client player stats from KV
          if (player.userid) {
            const stats = await this.storage.getPlayerStats(player.userid);
            game.gamecore.players.other.mmr = stats.mmr || 1000;
            console.log(
              `[GameService] Loaded client player stats: MMR=${stats.mmr}, Games=${stats.totalGames}`,
            );
          }

          // Add the client to the restored game
          game.addClient(player);

          // Save updated state back to KV
          await this.saveGameToKV(game);

          return game;
        } else {
          console.log(
            "[GameService] Failed to restore game from KV, creating new game",
          );
        }
      }
    }

    // No open games found, create new one
    console.log("[GameService] No open games found, creating new game");
    return await this.createGame(player);
  }

  async endGame(gameId, userId) {
    const game = this.games[gameId];
    if (!game) {
      console.log("[GameService] Game not found.");
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
    console.log(
      `[GameService] Game removed. There are ${this.game_count} games`,
    );

    // Remove from KV (both metadata and state)
    if (this.storage) {
      await this.storage.deleteGame(gameId);
      await this.storage.deleteGameState(gameId);
    }
  }

  async winGame(gameId, winner) {
    const game = this.games[gameId];
    if (!game) {
      console.log("[GameService] Game not found.");
      return;
    }

    game.stop();

    // Update player statistics in KV
    if (this.storage && game.player_host && game.player_client) {
      const hostWon = winner === 1;
      const clientWon = winner === -1;

      // Get MMR changes from game
      const hostMmrChange = game.gamecore?.players?.self?.mmrChange || 0;
      const clientMmrChange = game.gamecore?.players?.other?.mmrChange || 0;

      // Update both players' stats
      await this.storage.updatePlayerStats(
        game.player_host.userid,
        hostMmrChange,
        hostWon,
      );
      await this.storage.updatePlayerStats(
        game.player_client.userid,
        clientMmrChange,
        clientWon,
      );
    }

    // Handle both players
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
    console.log(
      `[GameService] Game removed. There are ${this.game_count} games`,
    );

    // Remove from KV (both metadata and state)
    if (this.storage) {
      await this.storage.deleteGame(gameId);
      await this.storage.deleteGameState(gameId);
    }
  }
}
