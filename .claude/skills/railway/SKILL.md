---
name: railway
description: Use when user mentions Railway deployment, production environment issues, environment variables, database migrations, deployment failures, or Railway CLI commands - provides Railway.com platform integration for Next.js with PostgreSQL operations, monitoring, and troubleshooting
---

# Railway Deployment & Management

## ⚠️ VERIFICATION REQUIRED

**BEFORE using this skill, verify the project uses Railway:**

1. **User explicitly mentions "Railway"** in their request, OR
2. **Check for Railway artifacts:**
   - `railway.json` or `railway.toml` file exists
   - `.railway` directory exists
   - Git repo shows Railway deployment history
3. **When in doubt, ASK:** "Is this project deployed to Railway?"

**DO NOT use this skill for:**
- Projects on Vercel, AWS, Heroku, or other platforms
- Projects where deployment platform is unclear
- "Deployment" questions without platform context

## Overview

Railway.com platform skill for deploying and managing Next.js applications with PostgreSQL. Provides CLI workflows for deployment, environment management, database operations, and troubleshooting.

**Core principle:** Use Railway CLI for deployments, database access, and environment management. Use internal DATABASE_URL (not PUBLIC) to avoid egress fees.

## When to Use

**ONLY after verifying this is a Railway project**, use this skill when you see:
- User explicitly says "Railway"
- "deploy to Railway" or "Railway deployment"
- "check Railway logs" or "deployment failed" (on Railway)
- "Railway environment variables" or "Railway database"
- "Railway CLI" commands
- Production troubleshooting (after confirming Railway)

## When NOT to Use

**NEVER use this skill for:**
- Projects on Vercel, AWS, Heroku, Netlify, Render, Fly.io
- Generic "deployment" questions (ask which platform first)
- Local development (unless explicitly using `railway run`)
- Database operations on non-Railway databases
- General Next.js questions unrelated to Railway
- **When platform is unclear** - ASK THE USER FIRST

**If uncertain, verify first:**
```bash
# Check for Railway configuration
ls -la railway.json railway.toml .railway/
# If files don't exist → NOT a Railway project → DON'T use this skill
```

## Quick Reference

| Task | Command |
|------|---------|
| Deploy | `railway up` |
| Check status | `railway status` |
| View logs | `railway logs` |
| Build logs | `railway logs --build` |
| Set variable | `railway variables --set "KEY=VALUE"` |
| List variables | `railway variables --kv` |
| Connect to DB | `railway connect postgres` |
| Run migrations | `railway run node scripts/migrate.js` |
| Open dashboard | `railway open` |
| Redeploy | `railway redeploy --yes` |
| Switch env | `railway environment [ENV]` |

## Project Verification

**Before running ANY Railway commands, verify project uses Railway:**

```bash
# Method 1: Check for Railway config files
ls railway.json railway.toml .railway/

# Method 2: Check if linked to Railway
railway status

# Method 3: Ask user
# "Is this project deployed to Railway, or using another platform?"
```

**If no Railway artifacts found → ASK USER before proceeding.**

## Essential Patterns

**Deploy Workflow:**
```bash
railway status && railway up && railway logs
```

**Debug Failed Deployment:**
```bash
railway logs --build  # Check build errors
railway variables     # Verify env vars
railway run npm run build  # Test locally
```

**Database Migration (ALWAYS backup first):**
```bash
railway run pg_dump -Fc > backup.dump  # 1. BACKUP FIRST (mandatory)
railway connect postgres -c "\dt"      # 2. Check current state
railway run node scripts/migrate.js    # 3. Run migration
railway connect postgres -c "\dt"      # 4. Verify changes
```

## Common Mistakes

**1. Using PUBLIC_URL instead of internal DATABASE_URL** - causes egress charges
**2. Forgetting to redeploy after setting variables** - use `railway redeploy --yes`
**3. Not testing locally** - always `railway run npm run build` first
**4. Hardcoded PORT** - use `process.env.PORT || 3000` (Railway assigns PORT)
**5. Next.js env vars at build-time** - vars must exist during build, not just runtime; use lazy initialization for module-level code
**6. Running migrations without backup** - ALWAYS backup first: `railway run pg_dump -Fc > backup.dump`
**7. Re-running failed migrations** - diagnose state first, don't re-run blindly

## Additional Resources

**Detailed documentation in supporting files:**
- **[reference.md](reference.md)** - Complete CLI command reference with all options
- **[examples.md](examples.md)** - Real-world workflows, scripts, CI/CD pipelines
- **[troubleshooting.md](troubleshooting.md)** - Error messages, diagnosis, solutions
- **[migrations.md](migrations.md)** - Database migration strategies

**Official Railway resources:**
- **CLI Docs:** https://docs.railway.com/reference/cli-api
- **Status Page:** https://status.railway.com/
- **Discord:** https://discord.gg/railway

## Best Practices

- **Check logs first:** `railway logs --build` when debugging
- **Test locally:** `railway run npm run build` before deploying
- **Use internal DATABASE_URL** (not PUBLIC_URL) to avoid egress fees
- **Backup before migrations:** `railway run pg_dump -Fc > backup.dump`
- **Monitor deployments:** `railway logs | grep -i error`

## When Deployment Fails

**CRITICAL: Diagnose before acting. Never guess under pressure.**

1. `railway logs --build` - check build errors FIRST
2. `railway variables` - verify env vars exist
3. `railway run npm run build` - test locally with Railway env
4. Check troubleshooting.md for specific error messages
5. Railway status: https://status.railway.com/

**For database issues: backup → diagnose → fix → verify**
