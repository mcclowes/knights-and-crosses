# Knights & Crosses - Deployment Guide

## Deployment Options

This guide covers deploying Knights & Crosses using a **hybrid approach** with:
- **Railway** for the WebSocket game server
- **Vercel** for the Next.js frontend
- **Redis (via Vercel Marketplace)** for persistence

> **Note**: Earlier versions of this project used `@vercel/kv`. That package and the Vercel KV product are sunset. The codebase now uses the standard `redis` client and only reads the `KV_URL` environment variable — ignore any stray `KV_REST_API_*` references.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option A: Single Server Deployment (Railway)](#option-a-single-server-deployment-railway)
3. [Option B: Hybrid Deployment (Railway + Vercel)](#option-b-hybrid-deployment-railway--vercel)
4. [Environment Variables](#environment-variables)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ GitHub account (for repository)
- ✅ Railway account (https://railway.app)
- ✅ Vercel account (https://vercel.com) - Optional for hybrid
- ✅ A Redis instance (provisioned via the Vercel Marketplace, Upstash directly, or any Redis host)

---

## Option A: Single Server Deployment (Railway)

Deploy everything (Next.js + WebSocket server) to Railway.

### Step 1: Provision Redis (Vercel Marketplace)

1. Go to your Vercel dashboard → **Storage** (or Marketplace)
2. Install a Redis integration (e.g. Upstash)
3. Open the integration's `.env.local` tab and copy the `KV_URL` value

### Step 2: Deploy to Railway

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

2. **Login to Railway:**
```bash
railway login
```

3. **Initialize project:**
```bash
railway init
```

4. **Deploy to Railway:**
```bash
railway up
```

5. **Set environment variables in Railway Dashboard:**
```bash
# Open Railway dashboard in browser
railway open

# In the dashboard:
# 1. Click "Variables" tab
# 2. Add the following variables:
#    - NODE_ENV = production
#    - PORT = 3000
#    - KV_URL = <your_redis_url>
# 3. Railway will automatically redeploy with new variables
```

6. **Get your public URL:**
```bash
railway domain
```

Your game will be available at `https://your-app.railway.app`

---

## Option B: Hybrid Deployment (Railway + Vercel)

Deploy WebSocket server to Railway and frontend to Vercel.

### Step 1: Provision Redis (Vercel Marketplace)

1. Go to your Vercel dashboard → **Storage** (or Marketplace)
2. Install a Redis integration (e.g. Upstash)
3. Copy the `KV_URL` value (you'll reuse it in both deployments)

### Step 2: Deploy WebSocket Server to Railway

1. **Create `.env.railway` file:**
```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Redis (Vercel Marketplace integration)
KV_URL=<your_redis_url>

# CORS - Allow Vercel frontend
ALLOWED_ORIGINS=https://your-app.vercel.app
```

2. **Deploy to Railway:**
```bash
# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# Open Railway dashboard to set environment variables
railway open

# In the dashboard:
# 1. Go to "Variables" tab
# 2. Add environment variables:
#    - NODE_ENV = production
#    - PORT = 3000
#    - KV_URL = <your_redis_url>
# 3. Railway auto-redeploys

# Get your Railway URL
railway domain
```

**Save your Railway URL:** `https://your-game.railway.app`

### Step 3: Deploy Frontend to Vercel

1. **Go to Vercel Dashboard:**
   - Visit https://vercel.com/new
   - Import your GitHub repository

2. **Configure Environment Variables in Vercel:**

Go to Project Settings → Environment Variables:

```bash
# WebSocket Server URL (your Railway URL)
NEXT_PUBLIC_WS_URL=https://your-game.railway.app

# Redis (same as Railway)
KV_URL=<your_redis_url>
```

3. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete

4. **Your game will be live at:**
   - Frontend: `https://your-app.vercel.app`
   - WebSocket: `https://your-game.railway.app`

### Step 4: Update CORS (if needed)

Update Railway environment variables to allow Vercel frontend:

1. Open Railway dashboard: `railway open`
2. Go to "Variables" tab
3. Add variable: `ALLOWED_ORIGINS` = `https://your-app.vercel.app`
4. Railway will auto-redeploy

---

## Environment Variables

### Required for All Deployments

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `KV_URL` | Redis connection URL (from Vercel Marketplace integration) | `redis://default:...@host:6379` |

### Required for Hybrid Deployment

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | `https://your-game.railway.app` |
| `ALLOWED_ORIGINS` | Allowed browser origin(s) for CORS, **comma-separated** | `https://your-app.vercel.app,https://www.example.com` |

> If `ALLOWED_ORIGINS` is unset in production, the server only accepts
> **same-origin** WebSocket connections. A hybrid (separate frontend host)
> deployment must set it or the browser handshake is rejected.

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` | `info` (prod), `debug` (dev) |
| `ENABLE_REDIS_ADAPTER` | Attach the Socket.IO Redis adapter (horizontal-scaling groundwork; needs `KV_URL` + sticky sessions) | `false` |

---

## Health Checks & Graceful Shutdown

The standalone server (`server.js`) exposes a lightweight health endpoint at
**`/healthz`** (also `/api/health`). It returns `200` when healthy and `503`
when Redis is configured but unreachable:

```bash
curl https://your-game.railway.app/healthz
# {"ok":true,"status":"healthy","uptimeSeconds":42,"activeGames":3,"redis":"ok"}
```

`railway.json` points the platform health check at `/healthz`. Use the same
endpoint for any external uptime monitor.

On `SIGTERM`/`SIGINT` (Railway sends `SIGTERM` on redeploy/restart) the server
shuts down gracefully: it stops accepting connections, clears timers, closes the
Redis connection, and drains the HTTP server before exiting (10s hard cap).

## Path to Horizontal Scaling

**The server currently runs as a single instance.** Matchmaking holds raw socket
references in memory, so two matched players must land on the same process. Redis
persists game state and player stats, but it does not by itself let two instances
exchange a game's real-time messages.

Running more than one instance today would let the load balancer place opponents
on different instances, and they would not see each other's moves. If you scale
out, keep it to one replica until the work below is done.

To support multiple instances:

1. **Sticky sessions** at the load balancer so a client keeps hitting the same
   instance for the life of its connection.
2. **Socket.IO Redis adapter** — set `ENABLE_REDIS_ADAPTER=true` (requires
   `KV_URL`). The wiring is in place (`src/server/config/socketConfig.js`); it
   makes cross-instance *broadcasts* work.
3. **Rooms instead of direct socket sends** — replace `player.send(...)` with
   room emits so the adapter can route them across instances.
4. **A shared matchmaking queue** in Redis so players are paired regardless of
   which instance they connected to.

Until 3 and 4 land, treat the deployment as single-instance.

## Testing Your Deployment

### Test WebSocket Connection

1. Open browser console on your game page
2. Look for log messages:
   ```
   Client libraries loaded successfully
   WebSocket URL: https://your-game.railway.app
   Connected to server!
   Server connection confirmed: { id: '...', name: 'Player ...' }
   ```

3. Try connecting with two different browsers/tabs
4. Both players should see "Game starting!"

### Test Matchmaking

1. Open game in Browser 1
2. Wait for "Waiting for opponent..."
3. Open game in Browser 2
4. Both should connect and start game

### Test Redis Persistence

1. Start a game
2. Restart Railway server:
   ```bash
   railway restart
   ```
3. Check logs to verify games are restored from Redis

---

## Troubleshooting

### WebSocket Connection Failed

**Problem:** Console shows connection errors

**Solutions:**
1. Check `NEXT_PUBLIC_WS_URL` is set correctly
2. Verify Railway app is running: `railway logs`
3. Check Railway domain is accessible: `curl https://your-game.railway.app`
4. Ensure WebSocket port is open (Railway handles this automatically)

### Players Can't Connect

**Problem:** Second player doesn't join game

**Solutions:**
1. Check Redis is configured correctly
2. Verify `KV_URL` is set in Railway
3. Check Railway logs: `railway logs`
4. Test Redis connection:
   ```bash
   railway run node scripts/test-redis.js
   ```

### CORS Errors

**Problem:** Browser shows CORS policy errors

**Solutions:**
1. Update `ALLOWED_ORIGINS` in Railway:
   ```bash
   railway variables set ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
2. Restart Railway deployment
3. Clear browser cache

### Railway Build Fails

**Problem:** Deployment fails during build

**Solutions:**
1. Check `railway.json` exists
2. Verify `package.json` has correct scripts:
   ```json
   {
     "scripts": {
       "build": "npm run copy-assets && next build",
       "start": "NODE_ENV=production node server.js"
     }
   }
   ```
3. Check Railway logs: `railway logs`

### Game State Not Persisting

**Problem:** Games lost after server restart

**Solutions:**
1. Verify `KV_URL` is set in Railway
2. Check Redis connection in logs (look for "Redis client connected successfully")
3. Inspect the env var:
   ```bash
   railway variables get KV_URL
   ```
4. Confirm your Redis instance is healthy in the Vercel Marketplace dashboard

---

## Monitoring

### Railway Logs

View real-time logs:
```bash
railway logs
```

### Vercel Logs

View frontend logs:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Logs" tab

### Key Metrics to Monitor

- Active WebSocket connections
- Active games count
- Redis hit/miss ratio
- Server memory usage
- Player connection errors

---

## Updating Your Deployment

### Update Railway

```bash
# Pull latest changes
git pull origin main

# Deploy to Railway
railway up
```

### Update Vercel

Vercel auto-deploys on git push to main branch:
```bash
git push origin main
```

Or manually trigger:
1. Go to Vercel Dashboard
2. Click "Deploy"

---

## Costs

### Railway
- Free: $5/month credit
- ~$7-10/month for small game
- ~$20-30/month for production

### Vercel
- Free: Hobby plan (sufficient for frontend)
- Redis (via Upstash on Marketplace): free tier available, paid tiers from ~$1/month

### Total Estimated Cost
- Development: $0 (Railway free tier)
- Production: $8-12/month

---

## Advanced: Custom Domain

### Railway Custom Domain

1. Go to Railway Dashboard
2. Select your project
3. Click "Settings" → "Domains"
4. Add custom domain: `wss://game.yourdomain.com`
5. Update DNS:
   ```
   CNAME game.yourdomain.com -> your-app.up.railway.app
   ```

### Vercel Custom Domain

1. Go to Vercel Dashboard
2. Project Settings → Domains
3. Add domain: `yourdomain.com`
4. Follow DNS instructions

### Update Environment Variables

After adding custom domains:

**Railway:**
```bash
railway variables set ALLOWED_ORIGINS=https://yourdomain.com
```

**Vercel:**
```bash
NEXT_PUBLIC_WS_URL=https://game.yourdomain.com
```

---

## Security Checklist

Before going to production:

- [ ] Change default PORT if needed
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` to your domain
- [ ] Use HTTPS/WSS (Railway provides this automatically)
- [ ] Rotate `KV_URL` credentials regularly
- [ ] Enable Railway health checks
- [ ] Set up monitoring/alerts
- [ ] Review Railway usage limits

---

## Support

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Socket.IO Docs: https://socket.io/docs
- GitHub Issues: https://github.com/mcclowes/knights-and-crosses/issues

---

**Last Updated:** 2026-07-08
**Version:** 2.1.0
