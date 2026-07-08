const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * Resolve the active log level from the environment.
 * Precedence: explicit LOG_LEVEL, then sensible per-environment defaults
 * (quiet in tests, info in production, debug in development).
 */
export function resolveLogLevel(env = process.env) {
  const explicit = (env.LOG_LEVEL || "").toLowerCase();
  if (explicit in LEVELS) {
    return explicit;
  }
  if (env.NODE_ENV === "test") return "warn";
  if (env.NODE_ENV === "production") return "info";
  return "debug";
}

/**
 * Level-aware logger. `log()` is treated as debug-level (chatty, dev-only)
 * to preserve the previous "verbose" gating behaviour; `info()` and above
 * always surface at the default production level.
 */
export class Logger {
  constructor(level) {
    // Back-compat: earlier code constructed `new Logger(verboseBoolean)`.
    if (typeof level === "boolean") {
      level = level ? "debug" : "info";
    }
    this.setLevel(level ?? resolveLogLevel());
  }

  setLevel(level) {
    this.level = level in LEVELS ? level : "info";
    this.threshold = LEVELS[this.level];
  }

  _enabled(level) {
    return LEVELS[level] <= this.threshold;
  }

  error(...args) {
    if (this._enabled("error")) console.error(...args);
  }

  warn(...args) {
    if (this._enabled("warn")) console.warn(...args);
  }

  info(...args) {
    if (this._enabled("info")) console.info(...args);
  }

  // Chatty, dev-oriented output (previously gated behind `verbose`).
  log(...args) {
    if (this._enabled("debug")) console.log(...args);
  }

  debug(...args) {
    if (this._enabled("debug")) console.debug(...args);
  }
}

/**
 * Shared singleton for modules that don't have a logger injected
 * (storage, game engine). Configured once from the environment.
 */
export const logger = new Logger(resolveLogLevel());

export default logger;
