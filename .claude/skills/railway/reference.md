# Railway CLI Complete Command Reference

This document provides comprehensive reference for all Railway CLI commands, their options, and usage patterns.

## Installation & Authentication

### Install Railway CLI

**macOS/Linux:**
```bash
# Using Homebrew (recommended)
brew install railway

# Using npm
npm install -g @railway/cli

# Using curl
curl -fsSL https://railway.app/install.sh | sh
```

**Windows:**
```powershell
# Using Scoop
scoop install railway

# Using npm
npm install -g @railway/cli
```

### Verify Installation
```bash
railway --version
# Expected: railway 4.10.0 or later
```

### Login
```bash
# Standard browser-based login
railway login

# Browserless login (for servers/CI)
railway login --browserless
# Returns pairing code to enter at https://railway.com/cli-login
```

### Logout
```bash
railway logout
```

### Check Authentication
```bash
railway whoami
# Shows: username, email, team
```

## Project Management

### Initialize New Project
```bash
# Create new project interactively
railway init

# Create with specific name
railway init --name "my-project"

# Create in specific workspace/team
railway init --workspace "team-name"
```

### Link Existing Project
```bash
# Interactive project selection
railway link

# Link specific project
railway link --project "project-id"

# Link with environment and service
railway link --project "project-id" --environment "production" --service "web"

# Link by team
railway link --team "team-name"
```

### Unlink Project
```bash
railway unlink
```

### Project Information
```bash
# Show current project status
railway status

# List all projects
railway list

# Open project in browser
railway open
```

## Deployment

### Deploy (Up)
```bash
# Basic deployment
railway up

# Detached deployment (non-blocking)
railway up --detach

# Deploy specific service
railway up --service web

# Deploy to specific environment
railway up --environment production

# CI mode (auto-detected with CI=true env var)
railway up --ci

# Verbose output
railway up --verbose

# Don't respect .gitignore
railway up --no-gitignore
```

**Options:**
- `--detach, -d`: Return immediately after upload
- `--service, -s`: Service to deploy to
- `--environment, -e`: Environment to deploy to
- `--ci`: Run in CI mode (build logs only, exit with code)
- `--verbose, -v`: Show verbose output
- `--no-gitignore`: Don't respect .gitignore file

### Redeploy
```bash
# Redeploy current service
railway redeploy

# Redeploy with confirmation
railway redeploy --yes

# Redeploy specific service
railway redeploy --service web --yes
```

**Options:**
- `--service, -s`: Service to redeploy
- `--yes, -y`: Skip confirmation prompt

### Remove Deployment (Down)
```bash
# Remove most recent deployment
railway down
```

### Deployment Subcommands (v4.10.0+)
```bash
# List deployments
railway deployment list

# Deploy (same as railway up)
railway deployment up

# Redeploy
railway deployment redeploy
```

## Environment Management

### Switch Environment
```bash
# Interactive environment selection
railway environment

# Switch to specific environment
railway environment production
railway environment staging
```

### Create New Environment
```bash
# Create new environment
railway environment new staging

# Create by duplicating existing environment
railway environment new staging --duplicate production

# Create with service variables
railway environment new staging --service-variable "web.NODE_ENV=staging"
```

**Options:**
- `--duplicate, -d`: Duplicate environment from existing
- `--service-variable, -sv`: Set service variable (format: "service.KEY=VALUE")

### Delete Environment
```bash
# Delete environment (interactive confirmation)
railway environment delete staging

# Delete with force (skip confirmation)
railway environment delete staging --force
```

## Environment Variables

### View Variables
```bash
# View all variables (table format)
railway variables

# View in key=value format
railway variables --kv

# Export format (for .env files)
railway variables --kv > .env

# View for specific service
railway variables --service web

# View for specific environment
railway environment production && railway variables
```

**Options:**
- `--kv`: Output in KEY=VALUE format
- `--service, -s`: Filter by service
- `--json`: Output as JSON

### Set Variables
```bash
# Set single variable
railway variables --set "API_KEY=secret123"

# Set multiple variables
railway variables --set "API_KEY=secret" --set "NODE_ENV=production"

# Set from file
cat .env.production | while read line; do
  railway variables --set "$line"
done
```

**Options:**
- `--set, -s`: Set variable (format: "KEY=VALUE")

### Delete Variables
```bash
# Delete variable
railway variables --delete "OLD_KEY"
```

**Options:**
- `--delete, -d`: Delete variable by key

## Running Commands with Railway Environment

### Run Command
```bash
# Execute single command with Railway environment
railway run npm run migrate

# Run with specific environment
railway run --environment production npm run seed

# Run with specific service context
railway run --service web npm test
```

**Options:**
- `--environment, -e`: Environment to load variables from
- `--service, -s`: Service to load variables from

**Common usage patterns:**
```bash
# Database migrations
railway run node scripts/migrate.js
railway run npx prisma migrate deploy

# Run tests with production-like env
railway run npm test

# Start local dev with Railway variables
railway run npm run dev

# Execute scripts
railway run python scripts/seed.py
```

### Shell
```bash
# Open shell with Railway environment loaded
railway shell

# Shell with specific environment
railway shell --environment production

# Shell with specific service
railway shell --service web
```

**Options:**
- `--environment, -e`: Environment to load
- `--service, -s`: Service to load

**Usage:**
```bash
$ railway shell
> echo $DATABASE_URL
postgresql://user:pass@host:5432/db
> npm run migrate
> exit
```

## Service Management

### Add Service
```bash
# Add database service
railway add --database postgres
railway add --database mysql
railway add --database redis
railway add --database mongo

# Add empty service
railway add --service my-api

# Add service from GitHub repo
railway add --repo "username/repo"

# Add service from Docker image
railway add --image "nginx:latest"

# Add service with environment variables
railway add --service api --variables "PORT=3000,NODE_ENV=production"
```

**Options:**
- `--database, -d`: Add database service (postgres|mysql|redis|mongo)
- `--service, -s`: Add empty service
- `--repo, -r`: Add service from GitHub repository
- `--image, -i`: Add service from Docker image
- `--variables, -v`: Set initial variables (comma-separated KEY=VALUE pairs)

### Link Service
```bash
# Link current directory to specific service
railway service web
railway service api
```

### Remove Service
```bash
# Remove service (use Railway dashboard)
railway open
# Navigate to service → Settings → Delete Service
```

## Database Operations

### Connect to Database
```bash
# Connect to PostgreSQL (opens psql)
railway connect postgres

# Connect to MySQL (opens mysql)
railway connect mysql

# Connect to Redis (opens redis-cli)
railway connect redis

# Connect to MongoDB (opens mongosh)
railway connect mongo

# Connect to specific environment database
railway connect postgres --environment production

# Execute SQL directly
railway connect postgres -c "SELECT * FROM users LIMIT 10;"

# Run SQL file
railway connect postgres < database/schema.sql
```

**Requirements:**
- PostgreSQL: `psql` must be installed
- MySQL: `mysql` must be installed
- Redis: `redis-cli` must be installed
- MongoDB: `mongosh` must be installed

**Options:**
- `--environment, -e`: Environment to connect to

**Common patterns:**
```bash
# Check tables
railway connect postgres -c "\dt"

# Check database size
railway connect postgres -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Run migration
railway connect postgres < migrations/001_init.sql

# Backup database
railway run pg_dump -Fc --no-acl --no-owner > backup.dump

# Restore database
railway run pg_restore -d $DATABASE_URL backup.dump
```

## Logging & Monitoring

### View Logs
```bash
# View real-time logs
railway logs

# View deployment logs
railway logs --deployment [DEPLOYMENT_ID]

# View build logs
railway logs --build

# Filter logs (using standard Unix tools)
railway logs | grep error
railway logs | grep -i "warning\|error"

# Save logs to file
railway logs > deployment.log
```

**Options:**
- `--deployment, -d`: View specific deployment logs
- `--build, -b`: View build logs only

**Pro tip:** Use with standard Unix tools:
```bash
# Count errors
railway logs | grep -c ERROR

# Watch for specific pattern
railway logs | grep --line-buffered "HTTP"

# Save errors only
railway logs | grep ERROR > errors.log
```

## Domain Management

### Generate Railway Domain
```bash
# Generate Railway subdomain
railway domain

# Generate for specific service
railway domain --service web
```

### Add Custom Domain
```bash
# Add custom domain
railway domain example.com

# Add custom domain to specific service
railway domain example.com --service web

# Configure port
railway domain example.com --port 8080
```

**Options:**
- `--service, -s`: Service to add domain to
- `--port, -p`: Port to route traffic to

### Remove Domain
```bash
# Remove domain (use Railway dashboard)
railway open
# Navigate to service → Settings → Domains → Delete
```

## Volume Management

### List Volumes
```bash
# List all volumes
railway volume list

# List volumes for specific service
railway volume list --service web
```

### Add Volume
```bash
# Add volume to service
railway volume add --service web --mount-path /data --name my-volume
```

**Options:**
- `--service, -s`: Service to add volume to
- `--mount-path, -m`: Mount path in container
- `--name, -n`: Volume name

### Delete Volume
```bash
# Delete volume
railway volume delete [VOLUME_ID]
```

### Attach/Detach Volume
```bash
# Attach volume to service
railway volume attach [VOLUME_ID] --service web

# Detach volume from service
railway volume detach [VOLUME_ID] --service web
```

## Templates

### Deploy Template
```bash
# Deploy template
railway deploy --template [TEMPLATE_URL]

# Deploy with variables
railway deploy --template [URL] --variable "PORT=3000" --variable "NODE_ENV=production"

# Deploy with service-specific variables
railway deploy --template [URL] --variable "web.PORT=3000" --variable "api.PORT=4000"
```

**Options:**
- `--template, -t`: Template URL or ID
- `--variable, -v`: Set template variables (KEY=VALUE or service.KEY=VALUE)

## SSH Access

### Connect via SSH
```bash
# SSH into service
railway ssh

# SSH to specific service
railway ssh --service web

# Execute command via SSH
railway ssh --service web -- ls -la

# SSH to specific deployment
railway ssh --service web --deployment [DEPLOYMENT_ID]
```

**Options:**
- `--service, -s`: Service to SSH into
- `--deployment, -d`: Specific deployment instance

**Best practices:**
- Use SSH for debugging only
- Don't make permanent changes via SSH
- Consider SSH access for investigation, not routine tasks

## Advanced Features

### Completion Scripts
```bash
# Generate shell completions
railway completion bash > /usr/local/etc/bash_completion.d/railway
railway completion zsh > /usr/local/share/zsh/site-functions/_railway
railway completion fish > ~/.config/fish/completions/railway.fish
```

**Supported shells:**
- bash
- zsh
- fish
- powershell
- elvish

### JSON Output
```bash
# Get machine-readable output
railway status --json
railway variables --json
railway list --json
```

Many commands support `--json` flag for scripting.

### Environment Variables for CLI

**RAILWAY_TOKEN**: Project token for non-interactive/CI use
```bash
RAILWAY_TOKEN=XXXXX railway up --detach
```

**CI**: Auto-detected in CI environments
```bash
CI=true railway up
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy to Railway
        run: railway up --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### GitLab CI Example
```yaml
deploy:
  stage: deploy
  script:
    - npm i -g @railway/cli
    - railway up --detach
  environment:
    name: production
  only:
    - main
  variables:
    RAILWAY_TOKEN: $RAILWAY_TOKEN
```

## Exit Codes

Railway CLI returns standard exit codes:
- `0`: Success
- `1`: General error
- `2`: Usage error
- Non-zero: Error occurred

Useful for CI/CD error handling:
```bash
if railway up; then
  echo "Deployment successful"
else
  echo "Deployment failed"
  exit 1
fi
```

## Global Flags

These flags work with most commands:

- `--help, -h`: Show help
- `--version, -V`: Show CLI version
- `--json`: Output as JSON
- `--verbose, -v`: Verbose output

## Tips & Tricks

### 1. Quick Deploy
```bash
# Alias for faster deployment
alias rd="railway up --detach && railway logs"
```

### 2. Environment Switching
```bash
# Create aliases for environments
alias prod="railway environment production"
alias staging="railway environment staging"
```

### 3. Variable Management
```bash
# Export variables to .env
railway variables --kv > .env.production

# Copy variables between environments
railway environment production && railway variables --kv > temp.env
railway environment staging
cat temp.env | while read line; do railway variables --set "$line"; done
rm temp.env
```

### 4. Database Backups
```bash
# Regular backup script
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
railway run pg_dump -Fc --no-acl --no-owner > "backups/db-$DATE.dump"
echo "Backup created: db-$DATE.dump"
```

### 5. Health Check Monitoring
```bash
# Monitor deployment health
railway up --detach && \
  sleep 30 && \
  curl -f https://your-app.railway.app/health || \
  (railway logs && exit 1)
```

### 6. Multi-Environment Deployment
```bash
# Deploy to multiple environments
for env in staging production; do
  echo "Deploying to $env..."
  railway environment $env
  railway up --detach
done
```

## Common Issues & Solutions

### Issue: "Not authenticated"
```bash
# Solution: Login again
railway login
```

### Issue: "Project not found"
```bash
# Solution: Link to project
railway link
```

### Issue: "Build failed"
```bash
# Solution: Check build logs
railway logs --build

# Test locally with Railway env
railway run npm run build
```

### Issue: "Environment variable not found"
```bash
# Solution: Check and set variables
railway variables
railway variables --set "MISSING_VAR=value"
```

### Issue: "Database connection failed"
```bash
# Solution: Verify DATABASE_URL
railway variables | grep DATABASE_URL

# Test connection
railway connect postgres -c "SELECT 1;"
```

## Version Information

This reference is for Railway CLI version 4.10.0 and later.

Check your version:
```bash
railway --version
```

Update CLI:
```bash
# npm
npm update -g @railway/cli

# Homebrew
brew upgrade railway
```

## Additional Resources

- **Official CLI Docs**: https://docs.railway.com/reference/cli-api
- **GitHub Repository**: https://github.com/railwayapp/cli
- **Railway Status**: https://status.railway.com/
- **Community Discord**: https://discord.gg/railway

---

**Last Updated**: January 2025 (Railway CLI v4.10.0)
