import type { NextApiRequest, NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Socket as NetSocket } from "net";
import { GameServer } from "../../src/game.server.js";
import { getConfig } from "../../src/server/config/env.js";
import { buildSocketServerOptions } from "../../src/server/config/socketConfig.js";
import { logger } from "../../src/server/utils/logger.js";

interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

// Configure Next.js to not parse the body for this API route.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Global singleton to persist Socket.IO across requests in the same container.
let globalIO: SocketIOServer | null = null;
let isInitializing = false;

/**
 * Socket.IO API route for Vercel-style serverless deployment.
 *
 * NOTE: serverless platforms cannot hold persistent WebSocket connections, so
 * this route only supports HTTP long-polling and is a best-effort fallback. The
 * supported production path is the standalone server (server.js) on Railway.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket,
) {
  logger.debug(`[Socket.IO] Request received: ${req.method} ${req.url}`);

  if (!res.socket?.server) {
    logger.error(
      "[Socket.IO] res.socket.server is undefined - cannot attach Socket.IO in this environment",
    );
    return res.status(501).json({
      error: "Socket.IO not supported",
      message:
        "This environment does not support Socket.IO. Use a Node.js server deployment (server.js).",
    });
  }

  let io = globalIO;

  if (!io && !isInitializing) {
    isInitializing = true;
    logger.info("[Socket.IO] Initializing serverless Socket.IO server...");

    try {
      io = new SocketIOServer(res.socket.server as unknown as HTTPServer, {
        ...buildSocketServerOptions(getConfig()),
        path: "/api/socket",
        addTrailingSlash: false,
        // Serverless supports polling only; no WebSocket upgrade.
        transports: ["polling"],
        allowUpgrades: false,
      });

      globalIO = io;
      res.socket.server.io = io;

      const gameServer = new GameServer(
        io as unknown as SocketIOServer,
        res.socket.server as unknown as HTTPServer,
      );

      // Non-blocking init so we don't delay the HTTP response.
      setImmediate(() => {
        gameServer
          .start()
          .then(() => {
            logger.info("[Socket.IO] Game server started");
            isInitializing = false;
          })
          .catch((error) => {
            logger.error("[Socket.IO] Game server start error:", error);
            isInitializing = false;
          });
      });
    } catch (error) {
      logger.error("[Socket.IO] Initialization failed:", error);
      isInitializing = false;
      if (!res.headersSent) {
        return res.status(500).json({ error: "Failed to initialize Socket.IO" });
      }
      return;
    }
  } else if (isInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (globalIO) {
      io = globalIO;
    } else {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "Server is initializing, please try again",
      });
    }
  } else {
    io = globalIO!;
  }

  // Hand the request to Socket.IO's engine.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = (io as any).engine;
    if (engine && typeof engine.handleRequest === "function") {
      engine.handleRequest(req, res);
    } else if (!res.headersSent) {
      res.status(200).end();
    }
  } catch (error) {
    logger.error("[Socket.IO] Error delegating to engine:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
