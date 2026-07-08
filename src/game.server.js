import { v4 as UUID } from "uuid";
import { GameService } from "./server/services/GameService.js";
import { MessageHandler } from "./server/handlers/MessageHandler.js";
import { logger } from "./server/utils/logger.js";
import { RedisGameStorage } from "./server/storage/RedisGameStorage.js";
import { getConfig } from "./server/config/env.js";

/**
 * GameServer wires Socket.IO connections to the game service. It always runs
 * attached to an externally-provided HTTP server + Socket.IO instance (the
 * custom Next.js server in server.js, or the serverless API route). It does not
 * own an HTTP listener of its own.
 */
class GameServer {
  constructor(io, httpServer) {
    if (!io || !httpServer) {
      throw new Error(
        "GameServer requires a Socket.IO instance and an HTTP server",
      );
    }

    const config = getConfig();
    this.logger = logger;
    this.io = io;
    this.server = httpServer;
    this.startedAt = Date.now();

    // Redis storage is the source of truth when configured; otherwise the
    // service runs in-memory (fine for single-instance / local dev).
    this.storage = config.redisUrl ? new RedisGameStorage(this.logger) : null;
    if (!this.storage) {
      this.logger.warn("Redis storage disabled: KV_URL not set.");
    }

    this.gameService = new GameService(this.logger, this.storage);
    this.messageHandler = new MessageHandler(this.gameService);
  }

  async start() {
    await this.gameService.initialize();
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on("connection", (client) => {
      client.userid = UUID();
      client.playername = "Player " + client.userid.slice(0, 4);
      client.emit("onconnected", { id: client.userid, name: client.playername });
      this.logger.log(
        "Player " + client.playername + " (" + client.userid + ") connected",
      );

      // Find game async (fire and forget)
      this.gameService.findGame(client).catch((error) => {
        this.logger.error("Error finding game:", error);
      });

      client.on("message", (message) => {
        this.messageHandler.handleMessage(client, message);
      });

      client.on("setname", (name) => {
        // Bound, sanitised display name (strip control chars, cap length).
        if (typeof name !== "string") return;
        // eslint-disable-next-line no-control-regex
        client.playername = name.slice(0, 32).replace(/[\x00-\x1F\x7F]/g, "");
        this.logger.log(
          "Player " + client.userid + " renamed to " + client.playername,
        );
        if (client.game) {
          client.game.player_host?.send("s.n." + client.playername);
          client.game.player_client?.send("s.n." + client.playername);
        }
      });

      client.on("disconnect", () => {
        this.logger.log(
          "Client " +
            client.playername +
            " (" +
            client.userid +
            ") disconnected",
        );
        this.messageHandler.handleDisconnect(client);
        if (client.game?.id) {
          this.gameService.endGame(client.game.id, client.userid).catch((error) => {
            this.logger.error("Error ending game:", error);
          });
        }
      });
    });
  }

  /**
   * Health snapshot for the /healthz endpoint. Probes Redis when configured.
   */
  async getHealth() {
    let redis = "disabled";
    if (this.storage) {
      try {
        redis = (await this.storage.healthCheck()) ? "ok" : "error";
      } catch {
        redis = "error";
      }
    }
    const ok = redis !== "error";
    return {
      ok,
      status: ok ? "healthy" : "degraded",
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      activeGames: this.gameService.game_count,
      redis,
    };
  }

  /**
   * Release resources for a graceful shutdown: stop timers and close Redis.
   */
  async shutdown() {
    this.gameService.stopCleanupInterval();
    this.messageHandler.dispose();
    if (this.storage) {
      await this.storage.disconnect();
    }
  }
}

export { GameServer };
export default GameServer;
