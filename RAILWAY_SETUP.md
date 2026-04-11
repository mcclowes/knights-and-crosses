# Railway Deployment - Quick Start

## What Was Added

The following files have been added/updated to support Railway deployment:

### New Files

1. **`railway.json`** - Railway deployment configuration
2. **`DEPLOYMENT.md`** - Comprehensive deployment guide
3. **`.env.local.example`** - Local development environment template

### Updated Files

1. **`.env.example`** - Added `NEXT_PUBLIC_WS_URL` configuration
2. **`src/game.core.client.js`** - Updated to support configurable WebSocket URL
3. **`components/Game.tsx`** - Injects WebSocket URL from environment variable

---

## Quick Deploy to Railway

### 1. Prerequisites

```bash
# Install Railway CLI
npm install -g @railway/cli
```

### 2. Provision Redis (Vercel Marketplace)

1. Go to your Vercel dashboard → **Storage** (or Marketplace)
2. Install a Redis integration (e.g. Upstash)
3. Copy the `KV_URL` value from the integration's `.env.local` tab

### 3. Deploy

```bash
# Login to Railway
railway login

# Initialize project
railway init

# Deploy to Railway
railway up

# Set environment variables in Railway Dashboard
# (Railway will open in browser)
railway open

# In the Railway dashboard:
# 1. Go to "Variables" tab
# 2. Add these variables:
#    - NODE_ENV = production
#    - PORT = 3000
#    - KV_URL = <your_redis_url>
# 3. Railway will automatically redeploy

# Get your public URL
railway domain
```

Your game will be live at: `https://your-app.railway.app`

---

## Local Development

### 1. Create `.env.local` file

```bash
cp .env.local.example .env.local
```

### 2. Update `.env.local`

```bash
# Local development - no WebSocket URL needed
PORT=3000
NODE_ENV=development
NEXT_PUBLIC_WS_URL=http://localhost:3000

# Optional: add Redis URL if testing persistence locally
# KV_URL=redis://default:...@host:6379
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## How It Works

### WebSocket URL Configuration

The game now supports configurable WebSocket server URLs via environment variables:

1. **`NEXT_PUBLIC_WS_URL`** environment variable is read by Next.js
2. **Game component** (`components/Game.tsx`) injects it into `window.__WS_URL__`
3. **Client game code** (`game.core.client.js`) reads `window.__WS_URL__` to connect

### Connection Flow

```
Browser → Game.tsx → window.__WS_URL__ → game.core.client.js → Socket.IO → Railway Server
```

### Deployment Modes

**Local Development:**
- WebSocket URL: `http://localhost:3000`
- Connection: Same origin
- Redis: Optional

**Railway (Single Server):**
- WebSocket URL: `https://your-app.railway.app`
- Connection: Same origin (no env var needed)
- Redis: Required

**Railway + Vercel (Hybrid):**
- WebSocket URL: `https://your-game.railway.app`
- Connection: Cross-origin (env var required)
- Redis: Required

---

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` |
| `KV_URL` | Redis URL (from Vercel Marketplace integration) | `redis://default:...@host:6379` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | Same origin |
| `LOG_LEVEL` | Logging level | `info` |

---

## Testing

### Test WebSocket Connection

Open browser console and look for:
```
Client libraries loaded successfully
WebSocket URL: https://your-game.railway.app
Connected to server!
```

### Test Multiplayer

1. Open game in two browser tabs
2. Both should connect and start game
3. Play some moves
4. Verify state synchronizes correctly

---

## Troubleshooting

### Can't Connect to Server

**Check:**
1. Railway app is running: `railway logs`
2. WebSocket URL is correct: Check console logs
3. CORS is configured correctly

**Fix:**
```bash
railway restart
```

### Games Not Persisting

**Check:**
1. `KV_URL` is set in Railway
2. Redis connection succeeds (logs show "Redis client connected successfully")

**Test:**
```bash
railway run node scripts/test-redis.js
```

---

## Next Steps

1. **Read full deployment guide:** See `DEPLOYMENT.md`
2. **Configure custom domain:** Add your own domain
3. **Set up monitoring:** Track active games and connections
4. **Enable analytics:** Monitor player behavior

---

## Architecture

For detailed architecture documentation, see:
- **`ARCHITECTURE.md`** - Complete system architecture
- **`DEPLOYMENT.md`** - Detailed deployment guide

---

## Support

- Railway Docs: https://docs.railway.app
- Project Issues: https://github.com/mcclowes/knights-and-crosses/issues

---

**Ready to deploy!** 🚀
