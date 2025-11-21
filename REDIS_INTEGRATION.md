# Redis Integration Guide

## Overview

Knights & Crosses now uses **Redis** (via Vercel Marketplace) for persistent game state storage. This enables:

- ✅ **Serverless Persistence** - Game state survives function restarts
- ✅ **Cross-Instance Access** - Players can reconnect to games across different serverless instances
- ✅ **Player Statistics** - Track wins, losses, and MMR across games
- ✅ **Scalability** - Support for high-concurrency multiplayer games

## Architecture

### Storage Layer

The `RedisGameStorage` class (`src/server/storage/RedisGameStorage.js`) provides:

1. **Game Metadata Storage**
   - Game ID, player IDs, active status
   - TTL: 1 hour

2. **Full Game State Storage**
   - Board state, cards, decks, player hands
   - TTL: 1 hour

3. **Player Statistics**
   - Total games, wins, losses, MMR
   - TTL: 30 days

### Key Components

```
┌─────────────────────────────────────────────────┐
│  Client (Socket.io)                             │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  GameServer (src/game.server.js)                │
│  - Socket connection handling                   │
│  - Player management                            │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  GameService (src/server/services/)             │
│  - Game lifecycle management                    │
│  - Find/create/end games                        │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  RedisGameStorage                               │
│  - Persistent storage layer                     │
│  - Game state serialization                     │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Redis (Vercel Marketplace)                     │
│  - Managed Redis instance                       │
└─────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Get Your Redis URL from Vercel

1. Go to your project: https://vercel.com/mcclowes/knights-and-crosses
2. Navigate to **Integrations** → **Redis**
3. Click on your Redis integration
4. Go to the **".env.local"** tab
5. Copy the `KV_URL` value

It should look like:
```
redis://default:AbC1234xYz...@my-redis-instance.upstash.io:6379
```

### 2. Configure Environment Variables

Add the `KV_URL` to your `.env.local` file:

```bash
# Redis Configuration
KV_URL=redis://default:YOUR_PASSWORD@your-redis-host.com:6379
```

### 3. Test the Connection

Run the test script to verify everything works:

```bash
node scripts/test-redis.js
```

Expected output:
```
🔍 Testing Redis connection...
✓ KV_URL found: redis://default:****@...
✅ Connected successfully!
✅ Health check passed!
✅ Test game saved!
✅ Test game retrieved successfully!
🎉 All tests passed!
```

### 4. Start Your Server

```bash
npm run dev
```

Redis will automatically connect when the server starts. Look for this log:

```
Redis client connected successfully
[GameService] Running in KV-first mode for serverless persistence
```

## How It Works

### Game State Persistence

When a game is created or updated:

```javascript
// 1. Game created in memory
const game = new Game(player, logger);

// 2. Game state saved to Redis
await storage.saveGame(game);
await storage.saveGameState(game.id, gameState);

// 3. On reconnect, game restored from Redis
const game = await storage.loadGameFromKV(gameId, socket);
```

### Data Structure in Redis

#### Keys

- `game:{gameId}` - Game metadata
- `game:state:{gameId}` - Full game state
- `player:stats:{userId}` - Player statistics
- `games:active` - Set of active game IDs

#### Example Data

**Game Metadata:**
```json
{
  "id": "abc123",
  "hostId": "user-456",
  "clientId": "user-789",
  "playerCount": 2,
  "active": true,
  "createdAt": 1705000000000
}
```

**Player Stats:**
```json
{
  "userId": "user-456",
  "totalGames": 15,
  "wins": 8,
  "losses": 7,
  "mmr": 1125,
  "lastUpdated": 1705000000000
}
```

## API Reference

### RedisGameStorage Methods

#### Connection
```javascript
await storage.connect()          // Connect to Redis
await storage.ensureConnected()  // Ensure connection is active
await storage.healthCheck()      // Verify connection health
```

#### Game Operations
```javascript
await storage.saveGame(game)                    // Save game metadata
await storage.getGame(gameId)                   // Get game metadata
await storage.getAllGames()                     // Get all active games
await storage.findAvailableGame()               // Find game with < 2 players
await storage.deleteGame(gameId)                // Delete game
await storage.updateGamePlayerCount(gameId, 2)  // Update player count
```

#### Game State Operations
```javascript
await storage.saveGameState(gameId, state)  // Save full game state
await storage.getGameState(gameId)          // Get full game state
await storage.deleteGameState(gameId)       // Delete game state
```

#### Player Statistics
```javascript
await storage.getPlayerStats(userId)              // Get player stats
await storage.savePlayerStats(userId, stats)      // Save player stats
await storage.updatePlayerStats(userId, mmr, won) // Update after game
```

## Deployment

### Vercel Deployment

The Redis integration automatically works in Vercel serverless functions:

1. Your Redis integration environment variables are automatically injected
2. The `GameService` detects serverless mode
3. Redis storage is enabled automatically

### Railway Deployment

For Railway (or other platforms), add the `KV_URL` environment variable:

```bash
# Railway CLI
railway variables set KV_URL="redis://..."

# Or via Railway dashboard:
# Project → Variables → Add KV_URL
```

## Troubleshooting

### Connection Errors

**Problem:** `Error: connect ECONNREFUSED`

**Solution:**
- Verify `KV_URL` is set correctly in `.env.local`
- Check Redis instance is running in Vercel dashboard
- Run `node scripts/test-redis.js` to diagnose

### Data Not Persisting

**Problem:** Game state not saved to Redis

**Solution:**
- Ensure `KV_URL` environment variable is set
- Check server logs for "Running in KV-first mode"
- Verify `isServerless` is true in production

### Authentication Failed

**Problem:** `ReplyError: NOAUTH Authentication required`

**Solution:**
- Your `KV_URL` must include the password
- Format: `redis://default:PASSWORD@host:port`
- Re-copy the URL from Vercel dashboard

## Performance Considerations

### TTL (Time To Live) Settings

- **Game Metadata:** 1 hour
- **Game State:** 1 hour
- **Player Stats:** 30 days

Games inactive for > 1 hour are automatically cleaned up.

### Connection Pooling

The Redis client maintains a single connection per instance. In serverless environments, connections are created on-demand and closed after the function execution.

### Memory + Redis Strategy

The system uses a **hybrid approach**:

1. **Hot path (memory):** Active games are cached in memory for fast access
2. **Cold path (Redis):** Games are persisted to Redis for durability
3. **Recovery:** On reconnect, games are loaded from Redis to memory

This provides both speed and reliability.

## Migration from @vercel/kv

The codebase has been migrated from the deprecated `@vercel/kv` package to the standard `redis` client.

### Key Changes

| Old (@vercel/kv) | New (redis) |
|-----------------|-------------|
| `import { kv } from "@vercel/kv"` | `import { createClient } from "redis"` |
| `await kv.set(key, val, { ex: 60 })` | `await client.set(key, val, { EX: 60 })` |
| `await kv.get(key)` | `await client.get(key)` |
| `await kv.sadd(key, val)` | `await client.sAdd(key, val)` |
| `await kv.smembers(key)` | `await client.sMembers(key)` |

### Environment Variables

| Old | New |
|-----|-----|
| `KV_REST_API_URL` | ❌ Not used |
| `KV_REST_API_TOKEN` | ❌ Not used |
| `KV_URL` | ✅ Required |

## Support

For issues or questions:

1. Check logs: `npm run dev` and watch for Redis connection messages
2. Run diagnostics: `node scripts/test-redis.js`
3. Review Vercel Redis docs: https://vercel.com/docs/storage
4. Open issue: https://github.com/mcclowes/knights-and-crosses/issues
