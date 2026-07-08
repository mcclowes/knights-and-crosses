import { describe, it, expect } from "@jest/globals";
import {
  parseOrigins,
  getConfig,
  validateConfig,
} from "../server/config/env.js";
import {
  getCorsOrigin,
  buildSocketServerOptions,
} from "../server/config/socketConfig.js";
import { resolveLogLevel, Logger } from "../server/utils/logger.js";

describe("env config", () => {
  it("parses a comma-separated origins list, trimming and dropping blanks", () => {
    expect(parseOrigins("https://a.com, https://b.com , ")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
    expect(parseOrigins("")).toEqual([]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it("builds a typed config from the environment", () => {
    const cfg = getConfig({
      NODE_ENV: "production",
      PORT: "8080",
      KV_URL: "redis://localhost:6379",
      ALLOWED_ORIGINS: "https://game.example.com",
      LOG_LEVEL: "warn",
    });
    expect(cfg.isProduction).toBe(true);
    expect(cfg.port).toBe(8080);
    expect(cfg.redisUrl).toBe("redis://localhost:6379");
    expect(cfg.allowedOrigins).toEqual(["https://game.example.com"]);
    expect(cfg.logLevel).toBe("warn");
  });

  describe("validateConfig", () => {
    it("errors on a malformed KV_URL", () => {
      const { errors } = validateConfig(getConfig({ KV_URL: "not-a-url" }));
      expect(errors.join(" ")).toMatch(/KV_URL/);
    });

    it("accepts rediss:// URLs", () => {
      const { errors } = validateConfig(
        getConfig({ KV_URL: "rediss://secure:6380" }),
      );
      expect(errors).toEqual([]);
    });

    it("warns in production when Redis and origins are unset", () => {
      const { warnings } = validateConfig(getConfig({ NODE_ENV: "production" }));
      expect(warnings.join(" ")).toMatch(/KV_URL/);
      expect(warnings.join(" ")).toMatch(/ALLOWED_ORIGINS/);
    });

    it("errors when the Redis adapter is enabled without a Redis URL", () => {
      const { errors } = validateConfig(
        getConfig({ ENABLE_REDIS_ADAPTER: "true" }),
      );
      expect(errors.join(" ")).toMatch(/ENABLE_REDIS_ADAPTER/);
    });
  });
});

describe("socket config", () => {
  it("allows localhost + configured origins in development", () => {
    const origin = getCorsOrigin(getConfig({ NODE_ENV: "development" }));
    expect(origin).toContain("http://localhost:3000");
  });

  it("allows exactly the configured origins in production", () => {
    const origin = getCorsOrigin(
      getConfig({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "https://game.example.com",
      }),
    );
    expect(origin).toEqual(["https://game.example.com"]);
  });

  it("disallows cross-origin in production when unset", () => {
    const origin = getCorsOrigin(getConfig({ NODE_ENV: "production" }));
    expect(origin).toBe(false);
  });

  it("caps the HTTP buffer well below the default", () => {
    const opts = buildSocketServerOptions(getConfig({}));
    expect(opts.maxHttpBufferSize).toBe(1e6);
    expect(opts.cors).toBeDefined();
  });
});

describe("logger", () => {
  it("resolves an explicit LOG_LEVEL", () => {
    expect(resolveLogLevel({ LOG_LEVEL: "debug" })).toBe("debug");
  });

  it("falls back per environment", () => {
    expect(resolveLogLevel({ NODE_ENV: "test" })).toBe("warn");
    expect(resolveLogLevel({ NODE_ENV: "production" })).toBe("info");
    expect(resolveLogLevel({ NODE_ENV: "development" })).toBe("debug");
  });

  it("gates output by level", () => {
    const calls = [];
    const spy = (level) => (...args) => calls.push([level, args.join(" ")]);
    const orig = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      log: console.log,
      debug: console.debug,
    };
    console.error = spy("error");
    console.warn = spy("warn");
    console.info = spy("info");
    console.log = spy("log");
    console.debug = spy("debug");
    try {
      const logger = new Logger("warn");
      logger.error("e");
      logger.warn("w");
      logger.info("i"); // suppressed
      logger.debug("d"); // suppressed
      logger.log("l"); // suppressed (debug-level)
    } finally {
      Object.assign(console, orig);
    }
    const levels = calls.map((c) => c[0]);
    expect(levels).toContain("error");
    expect(levels).toContain("warn");
    expect(levels).not.toContain("info");
    expect(levels).not.toContain("debug");
    expect(levels).not.toContain("log");
  });
});
