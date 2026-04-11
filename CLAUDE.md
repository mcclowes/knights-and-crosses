# CLAUDE.md

Project-specific guidance for Claude Code working in this repo. Global preferences live in `~/.claude/CLAUDE.md`.

## Project overview

Knights and Crosses is a networked multiplayer TCG: a 4x4 Tic-Tac-Toe board combined with a 20-card deck whose cards mutate the board (damage, shield, freeze, block, destroy). It was built as the testbed for a research project on using genetic algorithms to balance competitive multiplayer games — AI instances play against each other and Elo/MMR data informs card balance decisions.

## Stack

- **Next.js 15** (App Router not in use; legacy `pages/` directory)
- **React 19** with TypeScript for the new UI layer
- **Custom Next.js server** (`server.js`) that attaches Socket.IO to the same HTTP server — required because WebSockets can't run on serverless
- **Socket.IO** for real-time gameplay
- **Redis** via Vercel Marketplace integration, using the standard `redis` client (NOT `@vercel/kv` — that package is sunset and the codebase has migrated away from it; only `KV_URL` is read from env)
- **Jest** for tests (ESM mode via `--experimental-vm-modules`)
- **Express** is a transitive dep but the primary HTTP handler is Next.js's own

## Architecture at a glance

```
server.js                       custom HTTP + Socket.IO bootstrap
├─ src/game.server.js           GameServer: socket connection manager
├─ src/server/services/         GameService: matchmaking, lifecycle
├─ src/server/storage/
│  └─ RedisGameStorage.js       Redis-backed persistence (createClient from "redis")
├─ src/game.core.server.js      Server-authoritative game engine
├─ src/game.core.client.js      Client-side game loop (legacy JS, loaded as script)
├─ src/game.core.ai.js          AI decision engine
├─ src/ai_manager.js            Spawns AI instances for training
└─ src/cards/                   Card effect parser/resolver (modular replacement
                                for the old 200-line resolve_card function)

pages/                          Next.js pages (index, deck-builder, ai-viewer)
components/Game.tsx             Canvas-hosting React component
public/                         Static assets, copied from src/ at build time
```

Client-side legacy JS (`game.core.client.js`, jQuery, dat.GUI) lives under `public/lib/` and is loaded via script tags. Don't try to convert it to React/TS piecemeal without a plan — it's interwoven with the canvas rendering.

## Running and scripts

- `npm run dev` — copy assets then `node server.js` (no Next.js build; uses Next's dev mode internally)
- `npm run build` — copy assets then `next build`
- `npm run start` — production server (`NODE_ENV=production node server.js`)
- `npm run create-ai` — spawn AI instances for training
- `npm test` — Jest (ESM)
- `npm run lint` / `npm run format`

The `copy-assets` step copies `src/game.core.client.js` to `public/` so the client can load it.

## Deployment notes

- Primary target is **Railway** (full WebSocket server) or **Railway + Vercel** hybrid (static on Vercel, WS on Railway). Vercel alone cannot host the WebSocket server because serverless functions can't hold persistent connections.
- The only Redis env var needed is `KV_URL` (provided by the Vercel Marketplace Redis integration). Older `KV_REST_API_URL` / `KV_REST_API_TOKEN` are no longer used — ignore any stray references.
- Optional: `NEXT_PUBLIC_WS_URL` to override the WebSocket endpoint (needed for the hybrid deployment).
- Without Redis, the server falls back to in-memory game storage — fine for local dev, not for multi-instance production.

## Conventions

- Prefer TypeScript for new code; the legacy `.js` files in `src/` stay as-is unless the task is specifically to migrate them.
- Server-authoritative: never trust client-supplied game state. Validate inputs in `GameCore.handleServerInput`.
- Tests live alongside implementation where feasible.
- Message protocol between client and server is the period-delimited string format (`TYPE.DATA1.DATA2`). See `ARCHITECTURE.md` for the full table.
- Card effects are defined as strings on card JSON and parsed by `src/cards/card-parser.cjs` — add new effects by extending `EffectType`, `Keywords`, parser, and resolver (documented in `src/cards/README.md`).

## Gotchas

- `@vercel/kv` is still listed in `package.json` but unused — safe to remove; nothing imports it.
- Vercel KV (the product) is sunset. If docs or tooling suggest provisioning "Vercel KV", that's outdated — use the Redis integration from the Vercel Marketplace instead.
- The `copy-assets` step is load-bearing: if `public/game.core.client.js` is missing after a fresh checkout, run `npm run dev` or `npm run build` before debugging.
- `default.profraw` in the repo root is a stray coverage artifact — ignore it, or add to `.gitignore` if it keeps reappearing.
- The custom `server.js` means Next.js middleware (`middleware.ts` / `proxy.ts`) has no effect in production — request interception has to happen in the custom server.

## Documentation map

- `README.md` — project overview and how-to-play
- `ARCHITECTURE.md` — system architecture, message protocol, scalability plans
- `DEPLOYMENT.md` — Railway + Vercel deployment walkthrough
- `RAILWAY_SETUP.md` — Railway quick-start
- `REDIS_INTEGRATION.md` — Redis storage layer (most accurate source of truth for persistence)
- `MIGRATION.md` — historical notes on the Next.js migration
- `src/cards/README.md` — card effect system
