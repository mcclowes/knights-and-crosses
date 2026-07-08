import { resolveLogLevel } from "../utils/logger.js";

/**
 * Parse a comma-separated ALLOWED_ORIGINS value into a trimmed list.
 */
export function parseOrigins(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Centralised, typed view of the runtime environment. Read once at startup.
 */
export function getConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
    port: Number(env.PORT) || 3000,
    logLevel: resolveLogLevel(env),
    redisUrl: env.KV_URL || null,
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    // Horizontal-scaling groundwork: opt-in Socket.IO Redis adapter.
    // Requires KV_URL and sticky sessions at the load balancer.
    enableRedisAdapter: env.ENABLE_REDIS_ADAPTER === "true",
  };
}

/**
 * Validate configuration at startup. Returns collected errors/warnings so the
 * caller decides whether to abort. Errors are fatal in production only.
 *
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateConfig(config = getConfig()) {
  const errors = [];
  const warnings = [];

  if (config.redisUrl) {
    if (!/^rediss?:\/\//.test(config.redisUrl)) {
      errors.push(
        "KV_URL is set but is not a valid redis:// or rediss:// URL.",
      );
    }
  } else if (config.isProduction) {
    warnings.push(
      "KV_URL is not set — running with in-memory storage. Game state and " +
        "player stats will not survive restarts and cannot be shared across instances.",
    );
  }

  if (config.isProduction && config.allowedOrigins.length === 0) {
    warnings.push(
      "ALLOWED_ORIGINS is not set — cross-origin WebSocket connections will be " +
        "rejected. Set it for a hybrid (separate frontend host) deployment.",
    );
  }

  if (config.enableRedisAdapter && !config.redisUrl) {
    errors.push(
      "ENABLE_REDIS_ADAPTER=true requires KV_URL to be set for the Socket.IO Redis adapter.",
    );
  }

  return { errors, warnings };
}

/**
 * Validate and report configuration, aborting the process on fatal errors in
 * production. Safe to call at server bootstrap.
 */
export function assertConfig(config = getConfig(), log = console) {
  const { errors, warnings } = validateConfig(config);

  for (const warning of warnings) {
    log.warn?.(`[config] ${warning}`);
  }
  for (const error of errors) {
    log.error?.(`[config] ${error}`);
  }

  if (errors.length > 0 && config.isProduction) {
    log.error?.("[config] Fatal configuration errors in production. Exiting.");
    process.exit(1);
  }

  return config;
}
