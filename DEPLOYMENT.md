# Knights & Crosses - Deployment Guide

## Deployment Options

This guide covers deploying Knights & Crosses using a **hybrid approach** with:
- **Railway** for the WebSocket game server
- **Vercel** for the Next.js frontend
- **Vercel KV** for Redis persistence

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
- ✅ Vercel KV database (for persistence)

---

## Option A: Single Server Deployment (Railway)

Deploy everything (Next.js + WebSocket server) to Railway.

### Step 1: Setup Vercel KV (Redis)

1. Go to https://vercel.com/dashboard/stores
2. Create a new KV database
3. Copy the connection credentials:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_URL`

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

4. **Set environment variables:**
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set KV_REST_API_URL=<your_kv_url>
railway variables set KV_REST_API_TOKEN=<your_kv_token>
railway variables set KV_URL=<your_redis_url>
```

5. **Deploy:**
```bash
railway up
```

6. **Get your public URL:**
```bash
railway domain
```

Your game will be available at `https://your-app.railway.app`

---

## Option B: Hybrid Deployment (Railway + Vercel)

Deploy WebSocket server to Railway and frontend to Vercel.

### Step 1: Setup Vercel KV

1. Go to https://vercel.com/dashboard/stores
2. Create a new KV database
3. Copy credentials (you'll need these for both deployments)

### Step 2: Deploy WebSocket Server to Railway

1. **Create `.env.railway` file:**
```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Vercel KV
KV_REST_API_URL=<your_kv_url>
KV_REST_API_TOKEN=<your_kv_token>
KV_URL=<your_redis_url>

# CORS - Allow Vercel frontend
CORS_ORIGIN=https://your-app.vercel.app
```

2. **Deploy to Railway:**
```bash
# Login
railway login

# Initialize project
railway init

# Set environment variables from file
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set KV_REST_API_URL=<your_kv_url>
railway variables set KV_REST_API_TOKEN=<your_kv_token>
railway variables set KV_URL=<your_redis_url>

# Deploy
railway up

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

# Vercel KV (same as Railway)
KV_REST_API_URL=<your_kv_url>
KV_REST_API_TOKEN=<your_kv_token>
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

```bash
railway variables set CORS_ORIGIN=https://your-app.vercel.app
```

---

## Environment Variables

### Required for All Deployments

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `KV_REST_API_URL` | Vercel KV REST API URL | `https://*.vercel-storage.com` |
| `KV_REST_API_TOKEN` | Vercel KV token | `your_token` |
| `KV_URL` | Redis connection URL | `redis://...` |

### Required for Hybrid Deployment

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | `https://your-game.railway.app` |
| `CORS_ORIGIN` | Allowed frontend origin | `https://your-app.vercel.app` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `MAX_PLAYERS_PER_GAME` | Players per game | `2` |
| `GAME_TIMEOUT` | Game timeout (ms) | `300000` |

---

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
2. Verify KV credentials are set in Railway
3. Check Railway logs: `railway logs`
4. Test Redis connection:
   ```bash
   railway run node -e "const kv = require('@vercel/kv'); kv.get('test').then(console.log)"
   ```

### CORS Errors

**Problem:** Browser shows CORS policy errors

**Solutions:**
1. Update `CORS_ORIGIN` in Railway:
   ```bash
   railway variables set CORS_ORIGIN=https://your-app.vercel.app
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
1. Verify Vercel KV credentials are set
2. Check Redis connection in logs
3. Test KV access:
   ```bash
   railway variables get KV_REST_API_URL
   ```
4. Ensure KV is not expired (check Vercel dashboard)

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
- KV: $1/month for 1GB storage

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
railway variables set CORS_ORIGIN=https://yourdomain.com
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
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Use HTTPS/WSS (Railway provides this automatically)
- [ ] Rotate KV tokens regularly
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

**Last Updated:** 2025-11-21
**Version:** 2.0.0
