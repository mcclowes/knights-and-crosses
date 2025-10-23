import type { NextApiRequest, NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Socket as NetSocket } from "net";
import { GameServer } from "../../src/game.server.js";

interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

// Configure Next.js to not parse the body for this API route
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Socket.IO API route for Vercel deployment
 * This route initializes Socket.IO on the serverless Next.js HTTP server
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket,
) {
  console.log(`[Socket.IO] Request received: ${req.method} ${req.url}`);

  // Check if socket and server exist
  if (!res.socket) {
    console.error(
      "[Socket.IO] res.socket is undefined - cannot initialize Socket.IO in this environment",
    );
    return res.status(501).json({
      error: "Socket.IO not supported",
      message:
        "This environment does not support Socket.IO. Please use a Node.js server deployment.",
    });
  }

  if (!res.socket.server) {
    console.error(
      "[Socket.IO] res.socket.server is undefined - cannot attach Socket.IO",
    );
    return res.status(501).json({
      error: "Socket.IO not supported",
      message: "HTTP server not available in this serverless environment.",
    });
  }

  // Initialize Socket.IO if not already initialized
  if (!res.socket.server.io) {
    console.log("[Socket.IO] Initializing server for the first time...");

    try {
      // Initialize Socket.IO with proper configuration for serverless
      console.log("[Socket.IO] Creating Socket.IO server instance...");
      const io = new SocketIOServer(res.socket.server as any, {
        path: "/api/socket",
        addTrailingSlash: false,
        cors: {
          origin: "*",
          methods: ["GET", "POST"],
          credentials: true,
        },
        // Configure transports - polling only for Vercel serverless (no WebSocket support)
        transports: ["polling"],
        allowUpgrades: false, // Don't allow upgrade to WebSocket on Vercel
        // Increase timeouts for serverless environment
        pingTimeout: 60000,
        pingInterval: 25000,
        // Increase max HTTP buffer size
        maxHttpBufferSize: 1e8,
        // Allow more permissive connection handling
        allowEIO3: true,
      });

      res.socket.server.io = io;
      console.log("[Socket.IO] Server instance created and attached");

      // Initialize the game server with Socket.IO
      console.log("[Socket.IO] Creating GameServer instance...");
      const gameServer = new GameServer(io, res.socket.server);
      console.log("[Socket.IO] GameServer instance created");

      // Use non-blocking initialization to not delay the response
      setImmediate(() => {
        console.log("[Socket.IO] Starting game server asynchronously...");
        gameServer
          .start()
          .then(() => {
            console.log("[Socket.IO] Game server started successfully");
          })
          .catch((error) => {
            console.error("[Socket.IO] Game server start error:", error);
            console.error("[Socket.IO] Error details:", {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : "No stack",
              name: error instanceof Error ? error.name : typeof error,
            });
          });
      });
    } catch (error) {
      console.error("[Socket.IO] Initialization failed:", error);
      console.error("[Socket.IO] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack",
        name: error instanceof Error ? error.name : typeof error,
        code: (error as any)?.code,
      });
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Failed to initialize Socket.IO",
          message: error instanceof Error ? error.message : String(error),
          details:
            error instanceof Error
              ? {
                  name: error.name,
                  stack: error.stack?.split("\n").slice(0, 5).join("\n"),
                }
              : {},
        });
      }
      return;
    }
  } else {
    console.log(
      "[Socket.IO] Server already initialized, reusing existing instance",
    );
  }

  // Return success - Socket.IO handles connections via its own mechanisms
  console.log("[Socket.IO] Returning 200 OK");
  if (!res.headersSent) {
    res.status(200).end();
  }
}
