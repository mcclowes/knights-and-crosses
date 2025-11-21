# Railway Troubleshooting Guide

Comprehensive troubleshooting guide for common Railway issues, error messages, and debugging techniques.

## Table of Contents

1. [Deployment Issues](#deployment-issues)
2. [Build Failures](#build-failures)
3. [Runtime Errors](#runtime-errors)
4. [Database Issues](#database-issues)
5. [Environment Variables](#environment-variables)
6. [Networking & Connectivity](#networking--connectivity)
7. [Performance Issues](#performance-issues)
8. [CLI Issues](#cli-issues)

## Deployment Issues

### Issue: Deployment Fails with No Clear Error

**Symptoms:**
- Deployment shows "Failed" status
- No specific error message in UI

**Diagnosis:**
```bash
# Check build logs
railway logs --build

# Check recent logs
railway logs | tail -100

# Check Railway status page
curl -s https://status.railway.com/ | grep -i incident
```

**Solutions:**

1. **Check railway.json configuration:**
```bash
cat railway.json
```
Ensure build and start commands are correct:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start"
  }
}
```

2. **Test build locally:**
```bash
railway run npm run build
railway run npm run start
```

3. **Check package.json scripts:**
```bash
cat package.json | jq '.scripts'
```
Ensure `build` and `start` scripts exist and are correct.

### Issue: "Build succeeded but service won't start"

**Symptoms:**
- Build phase completes successfully
- Service immediately crashes on startup
- Health checks fail

**Diagnosis:**
```bash
# Check startup logs
railway logs | grep -A 20 "Starting"

# Check for exit codes
railway logs | grep "exit code"

# Test locally with Railway environment
railway run npm run start
```

**Common Causes & Solutions:**

1. **Missing PORT environment variable:**
```javascript
// ❌ Wrong
const PORT = 3000;

// ✅ Correct
const PORT = process.env.PORT || 3000;
```

2. **Next.js specific - missing .next directory:**
```bash
# Verify build output exists
ls -la .next/

# Check build command in package.json
npm run build  # Should create .next directory
```

3. **Database connection failing on startup:**
```javascript
// Add retry logic for database connections
async function connectWithRetry(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.connect();
      console.log('✅ Database connected');
      return;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Failed to connect to database after retries');
}
```

### Issue: "Deployment stuck in 'Building' state"

**Symptoms:**
- Deployment shows "Building..." for >10 minutes
- No progress in logs

**Solutions:**

1. **Cancel and retry:**
```bash
# Cancel current deployment
railway down

# Deploy again
railway up
```

2. **Check for large dependencies:**
```bash
# Check node_modules size
du -sh node_modules/

# Consider using .slugignore or .dockerignore
echo "node_modules" > .slugignore
echo "*.test.js" >> .slugignore
echo "*.md" >> .slugignore
```

3. **Build timeout - optimize build:**
```json
{
  "build": {
    "buildCommand": "npm ci --prefer-offline && npm run build"
  }
}
```

## Build Failures

### Issue: "npm ERR! code ELIFECYCLE"

**Symptoms:**
```
npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! Exit status 1
```

**Diagnosis:**
```bash
# Check which script failed
railway logs --build | grep "npm ERR!"

# Test build locally
railway run npm run build 2>&1 | tee build.log
```

**Common Causes & Solutions:**

1. **TypeScript errors:**
```bash
# Check for type errors
npm run typecheck

# Fix or temporarily disable strict checking
# tsconfig.json
{
  "compilerOptions": {
    "strict": false  // Not recommended for production
  }
}
```

2. **Missing dependencies:**
```bash
# Check if all imports are installed
npm install

# Verify package-lock.json is committed
git status package-lock.json
```

3. **Next.js build errors:**
```bash
# Common Next.js issues
railway logs --build | grep "Error: "

# Check for:
# - ESLint errors (add .eslintrc.json with rules)
# - Missing environment variables in build
# - Import errors
```

### Issue: "Module not found" during build

**Symptoms:**
```
Error: Cannot find module 'some-package'
Module not found: Can't resolve 'some-package'
```

**Solutions:**

1. **Install missing dependency:**
```bash
npm install some-package
git add package.json package-lock.json
git commit -m "Add missing dependency"
git push
```

2. **Check dependency type (dev vs regular):**
```bash
# If package is needed at runtime, it should be in dependencies, not devDependencies
npm install --save-prod some-package

# If only needed for build, keep in devDependencies
npm install --save-dev some-package
```

3. **Clear build cache:**
```bash
# Railway caches builds; sometimes cache gets corrupted
# Delete .next or dist folder and redeploy
rm -rf .next dist
railway up
```

### Issue: "Out of memory" during build

**Symptoms:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions:**

1. **Increase Node.js memory limit:**
```json
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  }
}
```

2. **Optimize build:**
```javascript
// next.config.js
module.exports = {
  // Reduce memory usage
  experimental: {
    workerThreads: false,
    cpus: 1
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
}
```

3. **Use SWC instead of Babel (Next.js 12+):**
```json
// Already default in Next.js 12+, but verify:
// next.config.js
module.exports = {
  swcMinify: true
}
```

## Runtime Errors

### Issue: "Application crashes after deployment"

**Symptoms:**
- Service starts but crashes within seconds/minutes
- Restart loop in logs

**Diagnosis:**
```bash
# Watch logs in real-time
railway logs

# Look for uncaught exceptions
railway logs | grep -i "uncaught\|unhandled"

# Check exit codes
railway logs | grep "exit code"
```

**Common Causes & Solutions:**

1. **Uncaught Promise rejections:**
```javascript
// Add global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue (or implement graceful shutdown)
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Consider graceful shutdown
  process.exit(1);
});
```

2. **Database connection issues:**
```javascript
// Implement connection pooling and retry
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  // Don't exit - pool will retry
});
```

3. **Missing required environment variables:**
```javascript
// Validate required env vars on startup
function validateEnv() {
  const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'ANTHROPIC_API_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
}

validateEnv();
```

### Issue: "503 Service Unavailable"

**Symptoms:**
- Website shows 503 error
- Health checks failing

**Diagnosis:**
```bash
# Check service status
railway status

# Check if service is starting
railway logs | tail -50

# Test health endpoint
curl -v https://your-app.railway.app/api/health
```

**Solutions:**

1. **Service is still starting - wait:**
```bash
# Deployments can take 30-60 seconds to start
# Wait and retry
sleep 30 && curl https://your-app.railway.app/api/health
```

2. **Service crashed - check logs:**
```bash
railway logs | grep -i "error\|crash\|exit"
```

3. **Health check endpoint missing:**
```javascript
// Add health check endpoint
// app/api/health/route.ts (Next.js)
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
```

## Database Issues

### Issue: "Connection terminated unexpectedly"

**Symptoms:**
```
Error: Connection terminated unexpectedly
Error: Connection terminated due to connection timeout
```

**Diagnosis:**
```bash
# Check database connectivity
railway run node -e "
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => { console.log('✅ Connected'); client.end(); })
    .catch(err => { console.error('❌ Error:', err.message); });
"

# Check active connections
railway connect postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

**Solutions:**

1. **Increase connection timeout:**
```javascript
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,  // 10 seconds
  ssl: {
    rejectUnauthorized: false
  }
});
```

2. **Use connection pooling:**
```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Use pool instead of client
const result = await pool.query('SELECT * FROM users');
```

3. **Check connection limits:**
```bash
# Railway has connection limits per plan
# Ensure you're not exceeding them
railway connect postgres -c "SHOW max_connections;"
railway connect postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

### Issue: "remaining connection slots are reserved"

**Symptoms:**
```
FATAL: remaining connection slots are reserved for non-replication superuser connections
```

**Diagnosis:**
```bash
# Check current connection count vs max
railway connect postgres -c "
  SELECT max_conn, used, res_for_super
  FROM
    (SELECT count(*) used FROM pg_stat_activity) t1,
    (SELECT setting::int res_for_super FROM pg_settings WHERE name='superuser_reserved_connections') t2,
    (SELECT setting::int max_conn FROM pg_settings WHERE name='max_connections') t3;
"
```

**Solutions:**

1. **Close idle connections:**
```javascript
// Use connection pooling and ensure connections are released
const { rows } = await pool.query('SELECT * FROM users');
// Connection is automatically returned to pool
```

2. **Reduce connection pool size:**
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,  // Reduce from default 20
});
```

3. **Kill idle connections:**
```sql
-- Emergency: Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < current_timestamp - INTERVAL '10 minutes'
  AND pid <> pg_backend_pid();
```

### Issue: "Slow database queries"

**Symptoms:**
- Application is slow
- Requests timing out
- High database CPU

**Diagnosis:**
```bash
# Check slow queries
railway connect postgres -c "
  SELECT pid, now() - query_start as duration, state, query
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND now() - query_start > interval '5 seconds'
  ORDER BY duration DESC;
"

# Check table sizes
railway connect postgres -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    n_live_tup AS rows
  FROM pg_tables
  JOIN pg_stat_user_tables USING (schemaname, tablename)
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"

# Check missing indexes
railway connect postgres -c "
  SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
  FROM pg_stats
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    AND n_distinct > 100
  ORDER BY n_distinct DESC
  LIMIT 20;
"
```

**Solutions:**

1. **Add indexes for frequently queried columns:**
```sql
-- Find columns used in WHERE clauses and add indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_subscriptions_user_id ON subscriptions(user_id);
```

2. **Use EXPLAIN ANALYZE:**
```sql
EXPLAIN ANALYZE
SELECT * FROM users
WHERE email = 'user@example.com';
-- Look for Seq Scan (bad) vs Index Scan (good)
```

3. **Implement query optimization:**
```javascript
// Use select specific columns, not SELECT *
const { rows } = await pool.query(
  'SELECT id, email, name FROM users WHERE id = $1',
  [userId]
);

// Use pagination
const { rows } = await pool.query(
  'SELECT * FROM posts ORDER BY created_at DESC LIMIT 50 OFFSET $1',
  [offset]
);
```

## Environment Variables

### Issue: "Environment variable not found"

**Symptoms:**
```
TypeError: Cannot read property of undefined
process.env.SOME_VAR is undefined
```

**Diagnosis:**
```bash
# List all variables
railway variables

# Check specific variable
railway variables | grep SOME_VAR

# Verify in Railway dashboard
railway open  # Navigate to Variables tab
```

**Solutions:**

1. **Set missing variable:**
```bash
railway variables --set "SOME_VAR=value"
```

2. **Check variable scope:**
```bash
# Ensure you're in correct environment
railway status
railway environment production
railway variables
```

3. **Redeploy after setting variables:**
```bash
railway variables --set "NEW_VAR=value"
railway redeploy --yes
```

### Issue: "Variable set but not available in application"

**Symptoms:**
- Variable visible in `railway variables`
- But `process.env.VAR` is undefined in app

**Solutions:**

1. **Redeploy to pick up new variables:**
```bash
railway redeploy --yes
```

2. **Check variable name (case-sensitive):**
```bash
# Railway variables are case-sensitive
railway variables | grep -i api_key  # might show API_KEY vs api_key
```

3. **Verify variable is not being overwritten:**
```javascript
// Check if code overwrites the variable
console.log('DATABASE_URL before:', process.env.DATABASE_URL);
// ... your code ...
console.log('DATABASE_URL after:', process.env.DATABASE_URL);
```

## Networking & Connectivity

### Issue: "Cannot connect to external API"

**Symptoms:**
```
Error: connect ETIMEDOUT
Error: getaddrinfo ENOTFOUND api.example.com
```

**Diagnosis:**
```bash
# Test from Railway environment
railway run node -e "
  const https = require('https');
  https.get('https://api.anthropic.com', (res) => {
    console.log('✅ Connected, status:', res.statusCode);
  }).on('error', (e) => {
    console.error('❌ Error:', e.message);
  });
"
```

**Solutions:**

1. **Check API key is set:**
```bash
railway variables | grep API_KEY
```

2. **Verify API endpoint is correct:**
```javascript
// Add logging
console.log('Connecting to:', apiUrl);
const response = await fetch(apiUrl);
console.log('Response status:', response.status);
```

3. **Implement retry logic:**
```javascript
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### Issue: "CORS errors"

**Symptoms:**
```
Access to fetch at 'https://api.example.com' has been blocked by CORS policy
```

**Solutions:**

1. **Configure CORS in Next.js API routes:**
```javascript
// app/api/route.ts
export async function GET(request) {
  return Response.json({ data: 'value' }, {
    headers: {
      'Access-Control-Allow-Origin': '*',  // Or specific domain
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

2. **Use Next.js middleware:**
```javascript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  const response = NextResponse.next();

  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

## Performance Issues

### Issue: "Slow response times"

**Diagnosis:**
```bash
# Test response time
time curl https://your-app.railway.app/api/health

# Check logs for slow operations
railway logs | grep -i "slow\|timeout\|latency"

# Monitor from multiple locations
curl -o /dev/null -s -w "Time: %{time_total}s\n" https://your-app.railway.app/
```

**Solutions:**

1. **Implement caching:**
```javascript
// Redis caching example
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function getCachedData(key, fetchFunction, ttl = 3600) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetchFunction();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

2. **Enable Next.js caching:**
```javascript
// app/api/data/route.ts
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  const data = await fetchData();
  return Response.json(data);
}
```

3. **Optimize database queries:**
```javascript
// Add indexes, use connection pooling, implement pagination
// See Database Issues section above
```

### Issue: "High memory usage"

**Diagnosis:**
```bash
# Check Railway dashboard for memory usage
railway open  # Navigate to Metrics

# Check for memory leaks in code
railway logs | grep -i "memory\|heap"
```

**Solutions:**

1. **Implement memory monitoring:**
```javascript
setInterval(() => {
  const used = process.memoryUsage();
  console.log({
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
  });
}, 30000); // Every 30 seconds
```

2. **Fix common memory leaks:**
```javascript
// ❌ Don't store data in global variables that grow over time
let globalCache = {};  // Memory leak!

// ✅ Use proper cache with expiration
import LRU from 'lru-cache';
const cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 });
```

3. **Increase memory limit (if needed):**
```json
{
  "scripts": {
    "start": "NODE_OPTIONS='--max-old-space-size=2048' next start"
  }
}
```

## CLI Issues

### Issue: "railway: command not found"

**Solutions:**

```bash
# Reinstall Railway CLI
brew install railway  # macOS
# or
npm install -g @railway/cli

# Verify installation
which railway
railway --version
```

### Issue: "Not authenticated" or "Invalid token"

**Solutions:**

```bash
# Login again
railway logout
railway login

# For CI/CD, regenerate token
railway open  # Go to Account → Tokens → Generate New Token

# Set token in CI environment
export RAILWAY_TOKEN=your-token-here
railway status
```

### Issue: "Project not found" or "Service not found"

**Solutions:**

```bash
# Relink project
railway unlink
railway link

# Verify link
railway status

# Link specific service
railway service web
```

## Emergency Debugging Checklist

When everything is broken:

```bash
# 1. Check Railway status page
curl -s https://status.railway.com/ | grep -i incident

# 2. Verify authentication
railway whoami

# 3. Check project status
railway status

# 4. Review recent logs
railway logs --build
railway logs | tail -100

# 5. Check environment variables
railway variables | head -20

# 6. Test locally
railway run npm run build
railway run npm run start

# 7. Check git status
git status
git log --oneline -5

# 8. Verify configuration
cat railway.json
cat package.json | jq '.scripts'

# 9. Test database connection
railway run node -e "const {Client} = require('pg'); new Client({connectionString: process.env.DATABASE_URL}).connect().then(() => console.log('✅ DB OK')).catch(e => console.error('❌', e.message))"

# 10. Check for recent changes
git diff HEAD~1 HEAD
```

## Getting Help

### Railway Support Channels

1. **Discord**: https://discord.gg/railway
2. **GitHub Issues**: https://github.com/railwayapp/cli/issues
3. **Documentation**: https://docs.railway.com/
4. **Status Page**: https://status.railway.com/

### What to Include in Support Requests

- Railway project ID
- Deployment ID (from logs or dashboard)
- Error messages (full text)
- Steps to reproduce
- Environment (CLI version, OS)
- Relevant configuration files (railway.json, package.json)

### Useful Debug Information

```bash
# Gather debug information
cat > railway-debug.txt <<EOF
Railway Status:
$(railway status)

Recent Logs:
$(railway logs | tail -50)

Environment Variables:
$(railway variables | head -20)

Configuration:
$(cat railway.json)

Package Scripts:
$(cat package.json | jq '.scripts')

Git Status:
$(git status)

Recent Commits:
$(git log --oneline -5)

CLI Version:
$(railway --version)
EOF

echo "Debug information saved to railway-debug.txt"
```

---

**Remember**: Most issues can be resolved by checking logs, verifying environment variables, and testing locally with `railway run`.
