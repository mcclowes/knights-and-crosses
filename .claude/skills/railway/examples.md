# Railway CLI Practical Examples

This document provides real-world examples and workflows for common Railway operations.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Development Workflows](#development-workflows)
3. [Deployment Scenarios](#deployment-scenarios)
4. [Database Operations](#database-operations)
5. [Environment Management](#environment-management)
6. [Monitoring & Debugging](#monitoring--debugging)
7. [CI/CD Pipelines](#cicd-pipelines)
8. [Migration Strategies](#migration-strategies)

## Initial Setup

### First-Time Project Setup

```bash
# 1. Install Railway CLI
brew install railway  # macOS
# or
npm install -g @railway/cli

# 2. Authenticate
railway login

# 3. Check authentication
railway whoami
# Output: username@example.com

# 4. Link to existing project
railway link
# Interactive: Select project from list

# 5. Verify connection
railway status
# Output:
# Project: resourceful-mercy
# Environment: production
# Service: web

# 6. Check environment variables
railway variables --kv
```

### Setting Up New Next.js Project on Railway

```bash
# 1. Initialize Railway project
railway init --name "my-nextjs-app"

# 2. Add PostgreSQL database
railway add --database postgres

# 3. Set environment variables
railway variables --set "NODE_ENV=production"
railway variables --set "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
railway variables --set "NEXTAUTH_URL=https://your-app.railway.app"

# 4. Create railway.json
cat > railway.json <<EOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF

# 5. Deploy
git add .
git commit -m "Initial Railway setup"
git push origin main

# Or deploy via CLI
railway up
```

## Development Workflows

### Local Development with Railway Environment

```bash
# Start dev server with Railway variables
railway run npm run dev

# Run tests with production-like environment
railway run npm test

# Execute database queries locally against Railway DB
railway run node scripts/test-db-connection.js

# Open shell with Railway environment
railway shell
> echo $DATABASE_URL
> npm run migrate
> exit
```

### Testing Before Deployment

```bash
# 1. Pull latest variables
railway variables --kv > .env.railway

# 2. Build locally with Railway environment
railway run npm run build

# 3. Start production server locally
railway run npm run start

# 4. Test in another terminal
curl http://localhost:3000/api/health

# 5. If all looks good, deploy
railway up
```

### Feature Branch Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-api

# 2. Make changes
# ... coding ...

# 3. Test locally with Railway env
railway run npm run build
railway run npm test

# 4. Create staging environment for testing
railway environment new feature-test

# 5. Deploy to feature environment
railway up --environment feature-test

# 6. Get feature environment URL
railway domain --service web

# 7. Test feature environment
curl https://feature-test.up.railway.app/api/health

# 8. If good, merge and deploy to production
git checkout main
git merge feature/new-api
railway environment production
railway up

# 9. Clean up feature environment
railway environment delete feature-test
```

## Deployment Scenarios

### Standard Deployment

```bash
# 1. Check current status
railway status
git status

# 2. Ensure all changes are committed
git add .
git commit -m "feat: add new feature"

# 3. Deploy
railway up

# 4. Monitor logs
railway logs

# 5. Test deployment
curl https://your-app.railway.app/api/health
```

### Emergency Rollback

```bash
# 1. Check recent deployments
railway open
# Go to Deployments tab

# 2. Find last good deployment ID
railway logs

# 3. Redeploy previous version
# Go to Railway dashboard → Deployments → Click on previous deployment → Redeploy

# Alternative: Deploy previous git commit
git log --oneline -5
git checkout [previous-commit-hash]
railway up --detach
git checkout main
```

### Multi-Environment Deployment

```bash
#!/bin/bash
# deploy-all.sh - Deploy to all environments

environments=("staging" "production")

for env in "${environments[@]}"; do
  echo "🚀 Deploying to $env..."

  # Switch environment
  railway environment $env

  # Deploy
  railway up --detach

  # Wait a bit
  sleep 10

  # Check health
  URL=$(railway variables | grep RAILWAY_PUBLIC_URL | cut -d'=' -f2)
  if curl -f "$URL/api/health" > /dev/null 2>&1; then
    echo "✅ $env deployment successful"
  else
    echo "❌ $env deployment failed"
    railway logs | tail -50
    exit 1
  fi
done

echo "🎉 All deployments successful!"
```

### Zero-Downtime Deployment

Railway handles zero-downtime deployments automatically, but you can verify:

```bash
# 1. Deploy with detach
railway up --detach

# 2. Monitor deployment
railway logs --deployment

# 3. Check old deployment is still serving traffic
# Railway keeps old deployment running until new one is healthy

# 4. Verify new deployment
sleep 30  # Wait for new deployment to be ready
curl https://your-app.railway.app/api/health

# 5. Check logs for any errors
railway logs | grep -i error
```

## Database Operations

### Database Connection and Queries

```bash
# Connect to PostgreSQL
railway connect postgres

# Inside psql:
\dt                    # List tables
\d users              # Describe users table
\l                    # List databases
\du                   # List roles
\x auto              # Expanded display
SELECT version();     # PostgreSQL version
\q                    # Quit

# Execute single query
railway connect postgres -c "SELECT COUNT(*) FROM users;"

# Run SQL file
railway connect postgres < database/queries/user-stats.sql
```

### Database Backup

```bash
#!/bin/bash
# backup-db.sh - Backup Railway PostgreSQL database

# Configuration
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-backup-$DATE.dump"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "📦 Creating backup..."
railway run pg_dump -Fc --no-acl --no-owner > $BACKUP_FILE

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(ls -lh $BACKUP_FILE | awk '{print $5}')
  echo "✅ Backup created: $BACKUP_FILE ($SIZE)"

  # Optional: Upload to S3
  # aws s3 cp $BACKUP_FILE s3://my-backups/railway/
else
  echo "❌ Backup failed"
  exit 1
fi

# Keep only last 7 backups
ls -t $BACKUP_DIR/db-backup-*.dump | tail -n +8 | xargs -r rm
echo "🧹 Cleaned old backups"
```

### Database Restore

```bash
#!/bin/bash
# restore-db.sh - Restore Railway PostgreSQL database

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore-db.sh <backup-file>"
  exit 1
fi

echo "⚠️  This will restore database from: $BACKUP_FILE"
echo "⚠️  ALL CURRENT DATA WILL BE LOST"
read -p "Are you sure? (type 'yes'): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

echo "🔄 Restoring database..."

# Get DATABASE_URL
DB_URL=$(railway variables --kv | grep ^DATABASE_URL= | cut -d'=' -f2-)

# Restore
railway run pg_restore --clean --if-exists --no-acl --no-owner -d "$DB_URL" $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "✅ Restore completed"
else
  echo "❌ Restore failed"
  exit 1
fi
```

### Database Migration

```bash
# Method 1: Using migration script
railway run node scripts/migrate.js

# Method 2: Direct SQL execution
railway connect postgres < database/migrations/001_init.sql

# Method 3: Using Prisma
railway run npx prisma migrate deploy

# Method 4: Using Knex
railway run npx knex migrate:latest

# Verify migration
railway connect postgres -c "SELECT version FROM migrations ORDER BY version DESC LIMIT 1;"
```

### Database Performance Check

```bash
#!/bin/bash
# db-health.sh - Check database health

echo "📊 Database Health Check"
echo "======================="

# Database size
echo -e "\n🗄️  Database Size:"
railway connect postgres -c "
  SELECT pg_size_pretty(pg_database_size(current_database())) as size;
"

# Table sizes
echo -e "\n📋 Top 5 Largest Tables:"
railway connect postgres -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 5;
"

# Active connections
echo -e "\n🔗 Active Connections:"
railway connect postgres -c "
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE state = 'active';
"

# Long running queries
echo -e "\n⏱️  Long Running Queries (>5 sec):"
railway connect postgres -c "
  SELECT
    pid,
    now() - query_start as duration,
    state,
    query
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND now() - query_start > interval '5 seconds'
  ORDER BY duration DESC;
"

# Index usage
echo -e "\n📑 Unused Indexes:"
railway connect postgres -c "
  SELECT
    schemaname,
    tablename,
    indexname
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0
    AND schemaname NOT IN ('pg_catalog', 'information_schema')
  LIMIT 5;
"
```

## Environment Management

### Creating Staging Environment

```bash
# 1. Create staging from production
railway environment new staging --duplicate production

# 2. Update staging-specific variables
railway environment staging
railway variables --set "NODE_ENV=staging"
railway variables --set "NEXTAUTH_URL=https://staging-app.railway.app"

# 3. Deploy to staging
railway up --environment staging

# 4. Get staging URL
railway domain --service web

# 5. Test staging
curl https://staging-app.railway.app/api/health
```

### Copying Variables Between Environments

```bash
#!/bin/bash
# sync-env-vars.sh - Copy variables from one environment to another

SOURCE_ENV="production"
TARGET_ENV="staging"

echo "📋 Copying variables from $SOURCE_ENV to $TARGET_ENV..."

# Export source variables
railway environment $SOURCE_ENV
railway variables --kv > /tmp/source-vars.env

# Import to target
railway environment $TARGET_ENV
while IFS= read -r line; do
  if [ -n "$line" ] && [[ ! "$line" =~ ^# ]]; then
    railway variables --set "$line"
    echo "✓ Set: ${line%%=*}"
  fi
done < /tmp/source-vars.env

# Clean up
rm /tmp/source-vars.env

echo "✅ Variables synced!"
```

### Environment-Specific Configuration

```bash
# Production
railway environment production
railway variables --set "LOG_LEVEL=info"
railway variables --set "ENABLE_DEBUG=false"
railway variables --set "RATE_LIMIT=100"

# Staging
railway environment staging
railway variables --set "LOG_LEVEL=debug"
railway variables --set "ENABLE_DEBUG=true"
railway variables --set "RATE_LIMIT=1000"

# Development (local)
railway environment development
railway variables --set "LOG_LEVEL=debug"
railway variables --set "ENABLE_DEBUG=true"
railway variables --set "RATE_LIMIT=unlimited"
```

## Monitoring & Debugging

### Real-Time Log Monitoring

```bash
# Watch all logs
railway logs

# Filter errors only
railway logs | grep -i error

# Filter with context (3 lines before and after)
railway logs | grep -i -B 3 -A 3 error

# Save logs to file with timestamp
railway logs | tee "logs/railway-$(date +%Y%m%d-%H%M%S).log"

# Watch for specific pattern
railway logs | grep --line-buffered "HTTP" | while read line; do
  echo "[$(date +'%H:%M:%S')] $line"
done
```

### Debugging Failed Deployment

```bash
#!/bin/bash
# debug-deployment.sh - Debug failed deployment

echo "🔍 Debugging Deployment"
echo "====================="

# 1. Check Railway status
echo -e "\n📊 Railway Status:"
railway status

# 2. Check build logs
echo -e "\n🔨 Build Logs (last 50 lines):"
railway logs --build | tail -50

# 3. Check recent logs
echo -e "\n📝 Recent Logs:"
railway logs | tail -100

# 4. Check environment variables
echo -e "\n⚙️  Environment Variables:"
railway variables | head -20

# 5. Test build locally
echo -e "\n🧪 Testing Build Locally:"
railway run npm run build

# 6. Check git status
echo -e "\n📁 Git Status:"
git status
git log --oneline -5

# 7. Check Railway configuration
echo -e "\n⚙️  Railway Configuration:"
cat railway.json

# 8. Check package.json scripts
echo -e "\n📦 Build Scripts:"
cat package.json | jq '.scripts | {build, start}'
```

### Health Check Script

```bash
#!/bin/bash
# health-check.sh - Comprehensive health check

APP_URL="https://web-production-69127.up.railway.app"

echo "🏥 Health Check"
echo "==============="

# API Health
echo -e "\n❤️  API Health:"
HEALTH=$(curl -s "$APP_URL/api/health")
echo $HEALTH | jq '.'

if echo $HEALTH | jq -e '.status == "ok"' > /dev/null; then
  echo "✅ API is healthy"
else
  echo "❌ API is unhealthy"
  exit 1
fi

# Response Time
echo -e "\n⏱️  Response Time:"
curl -o /dev/null -s -w "Time: %{time_total}s\n" "$APP_URL/api/health"

# Database Connection
echo -e "\n🗄️  Database:"
railway run node -e "
  const pg = require('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => client.query('SELECT 1'))
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err.message))
    .finally(() => client.end());
"

# Check recent errors
echo -e "\n🚨 Recent Errors:"
ERROR_COUNT=$(railway logs | grep -c -i error)
echo "Error count in recent logs: $ERROR_COUNT"

if [ $ERROR_COUNT -gt 10 ]; then
  echo "⚠️  High error count detected"
  railway logs | grep -i error | tail -5
fi

echo -e "\n✅ Health check complete"
```

## CI/CD Pipelines

### GitHub Actions - Full Pipeline

```yaml
# .github/workflows/railway-deploy.yml
name: Deploy to Railway

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm run test:ci

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy to Staging
        run: railway up --detach --environment staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}

      - name: Wait for deployment
        run: sleep 30

      - name: Health check
        run: |
          curl -f ${{ secrets.STAGING_URL }}/api/health || exit 1

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy to Production
        run: railway up --detach --environment production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

      - name: Wait for deployment
        run: sleep 30

      - name: Health check
        run: |
          curl -f https://web-production-69127.up.railway.app/api/health || exit 1

      - name: Run smoke tests
        run: npm run test:e2e:smoke
        env:
          TEST_URL: https://web-production-69127.up.railway.app

      - name: Notify success
        if: success()
        run: |
          echo "🎉 Production deployment successful!"
          # Add Slack/Discord notification here

      - name: Notify failure
        if: failure()
        run: |
          echo "❌ Production deployment failed!"
          # Add Slack/Discord notification here
```

### GitLab CI - Complete Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "20"

.node_setup:
  image: node:${NODE_VERSION}
  cache:
    paths:
      - node_modules/
      - .next/cache/

test:
  extends: .node_setup
  stage: test
  script:
    - npm ci
    - npm run lint
    - npm run typecheck
    - npm run test:ci
  coverage: '/Statements\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  extends: .node_setup
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - .next/
    expire_in: 1 hour

deploy_staging:
  extends: .node_setup
  stage: deploy
  environment:
    name: staging
    url: https://staging-app.railway.app
  script:
    - npm i -g @railway/cli
    - railway up --detach --environment staging
    - sleep 30
    - curl -f $STAGING_URL/api/health
  only:
    - staging
  variables:
    RAILWAY_TOKEN: $RAILWAY_TOKEN_STAGING

deploy_production:
  extends: .node_setup
  stage: deploy
  environment:
    name: production
    url: https://web-production-69127.up.railway.app
  script:
    - npm i -g @railway/cli
    - railway up --detach --environment production
    - sleep 30
    - curl -f https://web-production-69127.up.railway.app/api/health
  only:
    - main
  when: manual  # Require manual approval
  variables:
    RAILWAY_TOKEN: $RAILWAY_TOKEN
```

## Migration Strategies

### Database Schema Migration with Downtime

```bash
#!/bin/bash
# migrate-with-downtime.sh

echo "🔄 Starting migration with maintenance window"

# 1. Put app in maintenance mode (if you have one)
railway variables --set "MAINTENANCE_MODE=true"
railway redeploy --yes

# 2. Wait for deployment
sleep 30

# 3. Backup database
echo "📦 Creating backup..."
railway run pg_dump -Fc --no-acl --no-owner > "backup-pre-migration-$(date +%Y%m%d).dump"

# 4. Run migration
echo "🔄 Running migration..."
railway run node scripts/migrate.js

# 5. Verify migration
echo "✅ Verifying migration..."
railway connect postgres -c "\dt"

# 6. Turn off maintenance mode
railway variables --set "MAINTENANCE_MODE=false"
railway redeploy --yes

echo "✅ Migration complete!"
```

### Zero-Downtime Database Migration

```bash
#!/bin/bash
# migrate-zero-downtime.sh

echo "🔄 Starting zero-downtime migration"

# 1. Deploy code that supports both old and new schema
git checkout feature/migration-prep
railway up --detach
sleep 30

# 2. Run additive migration (add columns, don't drop anything)
railway run node scripts/migrate-add-columns.js

# 3. Wait and verify
sleep 60
railway logs | grep -i error

# 4. Deploy code that uses new schema
git checkout feature/use-new-schema
railway up --detach
sleep 30

# 5. Run cleanup migration (drop old columns)
railway run node scripts/migrate-cleanup.js

echo "✅ Zero-downtime migration complete!"
```

---

These examples cover most common Railway operations. Adapt them to your specific needs and workflow!
