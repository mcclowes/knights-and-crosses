import { getConfig } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * Resolve the Socket.IO CORS `origin` value.
 *
 * - Development: allow localhost plus any explicitly configured origins.
 * - Production with ALLOWED_ORIGINS set: allow exactly those origins.
 * - Production without ALLOWED_ORIGINS: `false` (same-origin only) so we never
 *   accidentally allow arbitrary cross-origin connections.
 *
 * @returns {string[] | boolean}
 */
export function getCorsOrigin(config = getConfig()) {
  if (!config.isProduction) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...config.allowedOrigins,
    ];
  }
  if (config.allowedOrigins.length > 0) {
    return config.allowedOrigins;
  }
  return false;
}

/**
 * Base Socket.IO server options shared by the standalone server (server.js)
 * and the serverless API route (pages/api/socket.ts).
 */
export function buildSocketServerOptions(config = getConfig()) {
  return {
    cors: {
      origin: getCorsOrigin(config),
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Heartbeats to detect dead connections.
    pingTimeout: 20000,
    pingInterval: 25000,
    // Game messages are tiny period-delimited strings; cap the buffer well
    // below the 1e8 default to blunt memory-exhaustion attacks.
    maxHttpBufferSize: 1e6,
    connectTimeout: 45000,
  };
}

/**
 * Horizontal-scaling groundwork: optionally attach the Socket.IO Redis adapter
 * so broadcasts fan out across instances. Opt-in via ENABLE_REDIS_ADAPTER and
 * requires KV_URL + sticky sessions at the load balancer.
 *
 * NOTE: the adapter alone does not make this game multi-instance — matchmaking
 * still holds raw socket references per instance (see DEPLOYMENT.md "Path to
 * horizontal scaling"). This wiring exists so that work can build on it.
 *
 * @returns {Promise<null | (() => Promise<void>)>} cleanup fn, or null if not attached
 */
export async function attachRedisAdapter(io, config = getConfig()) {
  if (!config.enableRedisAdapter || !config.redisUrl) {
    return null;
  }

  try {
    const [{ createAdapter }, { createClient }] = await Promise.all([
      import("@socket.io/redis-adapter"),
      import("redis"),
    ]);

    const pubClient = createClient({ url: config.redisUrl });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (err) => logger.error("Redis pub client error:", err));
    subClient.on("error", (err) => logger.error("Redis sub client error:", err));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("[socket] Redis adapter attached for horizontal scaling");

    return async () => {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    };
  } catch (error) {
    logger.error(
      "[socket] Failed to attach Redis adapter; continuing without it:",
      error,
    );
    return null;
  }
}
