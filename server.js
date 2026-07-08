import dotenv from "dotenv";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { GameServer } from "./src/game.server.js";
import { getConfig, assertConfig } from "./src/server/config/env.js";
import {
  buildSocketServerOptions,
  attachRedisAdapter,
} from "./src/server/config/socketConfig.js";
import { logger, resolveLogLevel } from "./src/server/utils/logger.js";

// Load local env files for standalone/dev runs. On Railway/Vercel real env vars
// are injected so these no-op; Next also loads them later and dotenv does not
// override already-set values. Runs before getConfig() reads the environment.
dotenv.config({ path: ".env.local" });
dotenv.config();
logger.setLevel(resolveLogLevel());

const config = assertConfig(getConfig(), logger);
const dev = !config.isProduction;
const port = config.port;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  let gameServer; // assigned before the server accepts connections

  const httpServer = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, "http://localhost");

      // Lightweight health endpoint (used by Railway / load balancers).
      if (pathname === "/healthz" || pathname === "/api/health") {
        const health = gameServer
          ? await gameServer.getHealth()
          : { ok: false, status: "starting" };
        res.writeHead(health.ok ? 200 : 503, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify(health));
        return;
      }

      // Let Next.js parse the URL and route the request.
      await handle(req, res);
    } catch (err) {
      logger.error("Error handling request:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    }
  });

  const io = new Server(httpServer, buildSocketServerOptions(config));
  const adapterCleanup = await attachRedisAdapter(io, config);

  gameServer = new GameServer(io, httpServer);
  try {
    await gameServer.start();
  } catch (error) {
    logger.error("Failed to start game server:", error);
    process.exit(1);
  }

  httpServer.once("error", (err) => {
    logger.error("HTTP server error:", err);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    logger.info(`> Ready on http://0.0.0.0:${port} (${config.nodeEnv})`);
  });

  // --- Graceful shutdown -------------------------------------------------
  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}; shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      logger.error("Shutdown timed out after 10s; forcing exit.");
      process.exit(1);
    }, 10000);
    forceExit.unref();

    try {
      io.close();
      await gameServer.shutdown();
      if (adapterCleanup) await adapterCleanup();
      await new Promise((resolve) => httpServer.close(resolve));
      logger.info("Shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown:", err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception:", err);
    shutdown("uncaughtException");
  });
});
