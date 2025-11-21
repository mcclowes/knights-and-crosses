# Railway Deployment & Management Skill

Comprehensive Claude Code skill for managing Railway.com deployments, databases, and production workflows.

## Overview

This skill provides expert Railway.com platform integration capabilities, including:

- **Deployment Management**: Deploy, redeploy, monitor deployments
- **Database Operations**: PostgreSQL management, migrations, backups
- **Environment Management**: Multi-environment workflows (staging, production)
- **Variable Management**: Secrets, environment variables, configuration
- **Monitoring & Debugging**: Logs, health checks, troubleshooting
- **CI/CD Integration**: GitHub Actions, GitLab CI, automated pipelines
- **Migration Strategies**: Zero-downtime deployments, schema changes

## Skill Files

- **SKILL.md**: Main skill instructions and quick reference
- **reference.md**: Complete Railway CLI command reference
- **examples.md**: Practical workflows and real-world examples
- **migrations.md**: Database migration best practices and patterns
- **troubleshooting.md**: Common issues, errors, and solutions

## Automatic Activation

Claude will automatically use this skill when you mention:

- "Railway" or "railway.com"
- "Deploy to production" or "deployment"
- "Environment variables" or "secrets"
- "Database migration" on Railway
- "Check logs" or "monitor deployment"
- "Railway CLI" commands
- Production troubleshooting
- CI/CD setup with Railway

## Quick Start Examples

### Deploy Application
```bash
railway up
```

### Check Deployment Status
```bash
railway status
railway logs
```

### Manage Environment Variables
```bash
railway variables
railway variables --set "API_KEY=secret"
```

### Database Operations
```bash
railway connect postgres
railway run node scripts/migrate.js
```

### Switch Environments
```bash
railway environment staging
railway environment production
```

## Current Project Configuration

**Project**: resourceful-mercy
**Environment**: production
**Service**: web
**Database**: PostgreSQL
**Builder**: Nixpacks
**Framework**: Next.js

## Key Features

### 1. Comprehensive CLI Integration
- All Railway CLI commands with examples
- Best practices and safety checks
- Error handling and debugging

### 2. Database Expertise
- PostgreSQL connection management
- Migration strategies (with and without downtime)
- Backup and restore procedures
- Performance optimization

### 3. Multi-Environment Support
- Development, staging, production workflows
- Environment-specific configurations
- Variable synchronization

### 4. Production-Ready Patterns
- Zero-downtime deployments
- Health monitoring
- Rollback strategies
- Security best practices

### 5. CI/CD Templates
- GitHub Actions workflows
- GitLab CI pipelines
- Automated testing and deployment

## Usage Tips

### Testing Before Production
```bash
# Test locally with Railway environment
railway run npm run build
railway run npm run start

# Deploy to staging first
railway environment staging
railway up

# Then production
railway environment production
railway up
```

### Database Migration Safety
```bash
# Always backup before migrations
railway run pg_dump -Fc --no-acl --no-owner > backup.dump

# Test migration
railway run node scripts/migrate.js

# Verify
railway connect postgres -c "\dt"
```

### Monitoring Deployments
```bash
# Watch logs in real-time
railway logs

# Check health
curl https://your-app.railway.app/api/health

# Monitor errors
railway logs | grep -i error
```

## Advanced Workflows

The skill includes detailed guides for:

- **Expand-Contract Pattern**: Zero-downtime schema changes
- **Blue-Green Deployments**: Safe production releases
- **Database Replication**: High availability setups
- **Performance Optimization**: Query tuning, indexing
- **Security Hardening**: Secrets management, access control

## Integration with This Project

This skill is configured for your workout-ai project with:

- Next.js 15 optimizations
- PostgreSQL connection pooling
- Automatic migration scripts
- Health check endpoints
- Environment-specific configurations

## Troubleshooting Quick Links

- Build failures → [troubleshooting.md](troubleshooting.md#build-failures)
- Database issues → [troubleshooting.md](troubleshooting.md#database-issues)
- Deployment errors → [troubleshooting.md](troubleshooting.md#deployment-issues)
- Runtime crashes → [troubleshooting.md](troubleshooting.md#runtime-errors)

## Learning Resources

- **Railway Documentation**: https://docs.railway.com/
- **Railway CLI Reference**: https://docs.railway.com/reference/cli-api
- **Railway Status**: https://status.railway.com/
- **Community Discord**: https://discord.gg/railway

## Contributing

This skill is project-specific and stored in `.claude/skills/railway/`. To update:

1. Edit the relevant markdown file
2. Commit changes to git
3. Team members automatically get updates on pull

## Version Information

**Created**: October 2025
**Railway CLI Version**: 4.10.0+
**Compatible with**: Next.js 13+, Node.js 18+
**Database**: PostgreSQL 14+

---

**Need help?** Just mention Railway, deployment, or database operations in your conversation with Claude!
