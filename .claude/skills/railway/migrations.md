# Railway PostgreSQL Migration Best Practices

Comprehensive guide for database migrations on Railway PostgreSQL with safety, rollback strategies, and zero-downtime techniques.

## Table of Contents

1. [Migration Fundamentals](#migration-fundamentals)
2. [Safety Checklist](#safety-checklist)
3. [Migration Patterns](#migration-patterns)
4. [Rollback Strategies](#rollback-strategies)
5. [Zero-Downtime Migrations](#zero-downtime-migrations)
6. [Common Scenarios](#common-scenarios)
7. [Tools & Scripts](#tools--scripts)

## Migration Fundamentals

### Key Principles

1. **Always backup before migrations**
2. **Test migrations locally first**
3. **Use transactions when possible**
4. **Keep migrations reversible**
5. **Document schema changes**
6. **Version control migration files**

### Railway-Specific Considerations

- **Use DATABASE_URL (internal)** not DATABASE_PUBLIC_URL to avoid egress fees
- **PostgreSQL version** - Ensure migrations are compatible with your version
- **Connection limits** - Railway PostgreSQL has connection limits per plan
- **Downtime requirements** - Plan for maintenance windows if needed
- **Backup storage** - Store backups externally (S3, etc.)

## Safety Checklist

Before running ANY migration:

```bash
# ✅ 1. Check current database state
railway connect postgres -c "\dt"  # List tables
railway connect postgres -c "\d [table_name]"  # Describe specific table

# ✅ 2. Backup database
railway run pg_dump -Fc --no-acl --no-owner > "backup-$(date +%Y%m%d-%H%M%S).dump"

# ✅ 3. Test migration locally with Railway environment
railway run npm run migrate:dry-run
# or
railway run psql < migrations/001_new_feature.sql --single-transaction

# ✅ 4. Check migration file syntax
cat migrations/001_new_feature.sql
# Verify: BEGIN; ... COMMIT; structure

# ✅ 5. Estimate migration time
railway connect postgres -c "EXPLAIN ANALYZE [your query];"

# ✅ 6. Check active connections
railway connect postgres -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# ✅ 7. Review deployment logs
railway logs | tail -50

# ✅ 8. Verify environment
railway status
railway variables | grep DATABASE_URL
```

## Migration Patterns

### Pattern 1: Simple Additive Migration (Safe)

**Use for:** Adding columns, indexes, tables

```sql
-- migrations/001_add_user_preferences.sql
BEGIN;

-- Add new column with default value
ALTER TABLE users
ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;

-- Add index (concurrently to avoid locking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preferences
ON users USING GIN (preferences);

-- Commit
COMMIT;
```

**Execute:**
```bash
railway connect postgres < migrations/001_add_user_preferences.sql
```

### Pattern 2: Transaction-Safe Migration

**Use for:** Multiple related changes that must succeed or fail together

```sql
-- migrations/002_create_subscriptions.sql
BEGIN;

-- Create new table
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Insert default data
INSERT INTO subscriptions (user_id, plan, status)
SELECT id, 'free', 'active' FROM users WHERE id NOT IN (SELECT user_id FROM subscriptions);

COMMIT;
```

### Pattern 3: Data Migration with Validation

**Use for:** Transforming existing data

```sql
-- migrations/003_normalize_emails.sql
BEGIN;

-- Add new column
ALTER TABLE users ADD COLUMN email_normalized VARCHAR(255);

-- Populate with normalized data
UPDATE users SET email_normalized = LOWER(TRIM(email));

-- Verify all emails were normalized
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM users WHERE email_normalized IS NULL AND email IS NOT NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Email normalization incomplete: % rows with null normalized emails', null_count;
  END IF;
END $$;

-- Add constraints after data is clean
ALTER TABLE users ALTER COLUMN email_normalized SET NOT NULL;
CREATE UNIQUE INDEX idx_users_email_normalized ON users(email_normalized);

COMMIT;
```

### Pattern 4: Schema Change with Backward Compatibility

**Use for:** Zero-downtime deployments

```sql
-- migrations/004_rename_column_safe.sql
-- Step 1: Add new column
BEGIN;
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
UPDATE users SET full_name = name;
COMMIT;

-- Step 2: Deploy code that writes to both columns
-- (Done in application code, not SQL)

-- Step 3: Backfill any remaining data
BEGIN;
UPDATE users SET full_name = name WHERE full_name IS NULL;
COMMIT;

-- Step 4: Drop old column (after code is deployed)
BEGIN;
ALTER TABLE users DROP COLUMN name;
COMMIT;
```

## Rollback Strategies

### Strategy 1: Database Restore

**For:** Critical failures, corrupted data

```bash
# Restore from backup
railway run pg_restore --clean --if-exists --no-acl --no-owner -d $DATABASE_URL backup.dump

# Verify restore
railway connect postgres -c "\dt"
railway connect postgres -c "SELECT COUNT(*) FROM users;"
```

### Strategy 2: Reverse Migration

**For:** Schema changes that can be reversed

```sql
-- migrations/005_add_column_down.sql
BEGIN;

-- Reverse of adding column
ALTER TABLE users DROP COLUMN IF EXISTS preferences;

-- Reverse of adding index
DROP INDEX IF EXISTS idx_users_preferences;

COMMIT;
```

**Execute rollback:**
```bash
railway connect postgres < migrations/005_add_column_down.sql
```

### Strategy 3: Point-in-Time Recovery (if enabled)

**For:** Recent mistakes with Railway backups enabled

```bash
# Contact Railway support or use their backup restoration feature
# Railway may offer point-in-time recovery depending on your plan
railway open  # Go to Database → Backups → Restore
```

## Zero-Downtime Migrations

### Technique 1: Expand-Contract Pattern

**Phase 1: Expand** - Add new schema elements
```sql
-- Add new column alongside old one
ALTER TABLE users ADD COLUMN email_new VARCHAR(255);
```

**Phase 2: Dual Write** - Application writes to both
```javascript
// In application code
await db.query('UPDATE users SET email = $1, email_new = $1 WHERE id = $2', [email, userId]);
```

**Phase 3: Backfill** - Copy data to new column
```sql
UPDATE users SET email_new = email WHERE email_new IS NULL;
```

**Phase 4: Verify** - Ensure data consistency
```sql
SELECT COUNT(*) FROM users WHERE email != email_new;  -- Should be 0
```

**Phase 5: Switch** - Application uses new column
```javascript
// Deploy new code that reads from email_new
```

**Phase 6: Contract** - Remove old column
```sql
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users RENAME COLUMN email_new TO email;
```

### Technique 2: Online Index Creation

**Problem:** Regular `CREATE INDEX` locks table

**Solution:** Use `CREATE INDEX CONCURRENTLY`

```sql
-- Don't use transaction for concurrent index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON users(email);

-- Verify index
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users' AND indexname = 'idx_users_email';
```

**Note:** `CREATE INDEX CONCURRENTLY` cannot be run inside a transaction.

### Technique 3: Table Partitioning Migration

**For:** Large tables that need partitioning

```sql
-- Step 1: Create partitioned table
CREATE TABLE users_new (
  id SERIAL,
  email VARCHAR(255),
  created_at TIMESTAMP,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE users_2024 PARTITION OF users_new
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Step 2: Copy data in batches (run multiple times with different ranges)
INSERT INTO users_new
SELECT * FROM users
WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01'
ON CONFLICT DO NOTHING;

-- Step 3: Swap tables (requires brief downtime)
BEGIN;
ALTER TABLE users RENAME TO users_old;
ALTER TABLE users_new RENAME TO users;
COMMIT;

-- Step 4: Verify and cleanup
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM users_old;
DROP TABLE users_old;
```

## Common Scenarios

### Scenario 1: Adding a NOT NULL Column

**Problem:** Adding NOT NULL column to large table causes long lock

**Solution:** Add column as nullable, backfill, then add constraint

```sql
-- Step 1: Add nullable column
BEGIN;
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
COMMIT;

-- Step 2: Backfill in batches
DO $$
DECLARE
  batch_size INTEGER := 1000;
  offset_val INTEGER := 0;
BEGIN
  LOOP
    UPDATE users
    SET phone = COALESCE(phone, '')
    WHERE id IN (
      SELECT id FROM users
      WHERE phone IS NULL
      LIMIT batch_size
    );

    EXIT WHEN NOT FOUND;
    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Processed % rows', offset_val;
    COMMIT;
  END LOOP;
END $$;

-- Step 3: Add NOT NULL constraint
BEGIN;
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
COMMIT;
```

### Scenario 2: Renaming a Column

**Problem:** Immediate rename breaks running application

**Solution:** Use views or gradual migration

```sql
-- Option 1: Using a view (quick fix)
BEGIN;
ALTER TABLE users RENAME COLUMN old_name TO new_name;
CREATE VIEW users_compat AS
  SELECT *, new_name AS old_name FROM users;
COMMIT;

-- Option 2: Gradual migration (preferred)
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN new_name VARCHAR(255);
UPDATE users SET new_name = old_name;

-- Step 2: Deploy code that uses new_name

-- Step 3: Drop old column
ALTER TABLE users DROP COLUMN old_name;
```

### Scenario 3: Changing Column Type

**Problem:** ALTER TYPE locks table and may fail with invalid data

**Solution:** Create new column, migrate data, swap

```sql
-- Change users.age from VARCHAR to INTEGER

-- Step 1: Add new column
BEGIN;
ALTER TABLE users ADD COLUMN age_new INTEGER;
COMMIT;

-- Step 2: Migrate valid data
BEGIN;
UPDATE users
SET age_new = age::INTEGER
WHERE age ~ '^\d+$';  -- Only numeric values
COMMIT;

-- Step 3: Handle invalid data
SELECT id, age FROM users WHERE age_new IS NULL AND age IS NOT NULL;
-- Fix manually or set default

-- Step 4: Drop old column and rename
BEGIN;
ALTER TABLE users DROP COLUMN age;
ALTER TABLE users RENAME COLUMN age_new TO age;
COMMIT;
```

### Scenario 4: Adding Foreign Key Constraint

**Problem:** Adding FK with existing data may fail or lock

**Solution:** Validate data first, then add constraint

```sql
-- Add FK: orders.user_id -> users.id

-- Step 1: Check for orphaned records
SELECT COUNT(*)
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.id IS NULL;

-- Step 2: Fix orphaned records
DELETE FROM orders WHERE user_id NOT IN (SELECT id FROM users);
-- or
UPDATE orders SET user_id = NULL WHERE user_id NOT IN (SELECT id FROM users);

-- Step 3: Add FK constraint (NOT VALID doesn't block reads)
BEGIN;
ALTER TABLE orders
ADD CONSTRAINT fk_orders_user_id
FOREIGN KEY (user_id) REFERENCES users(id)
NOT VALID;
COMMIT;

-- Step 4: Validate constraint in background
BEGIN;
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_user_id;
COMMIT;
```

### Scenario 5: Large Data Migration

**Problem:** Migrating millions of rows locks table

**Solution:** Batch processing with progress tracking

```sql
-- Update users.status based on subscription data

DO $$
DECLARE
  batch_size INTEGER := 10000;
  total_rows INTEGER;
  processed INTEGER := 0;
  start_time TIMESTAMP;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO total_rows FROM users WHERE status IS NULL;
  RAISE NOTICE 'Total rows to process: %', total_rows;

  start_time := clock_timestamp();

  LOOP
    -- Process batch
    WITH batch AS (
      SELECT id
      FROM users
      WHERE status IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    )
    UPDATE users u
    SET status = CASE
      WHEN EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = 'active')
      THEN 'premium'
      ELSE 'free'
    END
    FROM batch b
    WHERE u.id = b.id;

    -- Check if any rows were updated
    EXIT WHEN NOT FOUND;

    processed := processed + batch_size;
    RAISE NOTICE 'Processed % of % rows (%.1f%%) - Elapsed: %',
      processed,
      total_rows,
      (processed::float / total_rows * 100),
      clock_timestamp() - start_time;

    -- Brief pause to reduce load
    PERFORM pg_sleep(0.1);

    COMMIT;
  END LOOP;

  RAISE NOTICE 'Migration complete! Total time: %', clock_timestamp() - start_time;
END $$;
```

## Tools & Scripts

### Migration Runner Script

```javascript
// scripts/migrate.js
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get executed migrations
    const { rows: executed } = await client.query(
      'SELECT version FROM migrations ORDER BY version'
    );
    const executedVersions = new Set(executed.map(r => r.version));

    // Get migration files
    const migrationsDir = path.join(process.cwd(), 'database/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Run pending migrations
    for (const file of files) {
      const version = file.replace('.sql', '');

      if (executedVersions.has(version)) {
        console.log(`⏭️  Skipping ${version} (already executed)`);
        continue;
      }

      console.log(`🔄 Running ${version}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log(`✅ Completed ${version}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${version} failed: ${error.message}`);
      }
    }

    console.log('🎉 All migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
```

**Usage:**
```bash
railway run node scripts/migrate.js
```

### Pre-Migration Validation Script

```bash
#!/bin/bash
# scripts/validate-migration.sh

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: ./validate-migration.sh <migration-file>"
  exit 1
fi

echo "🔍 Validating migration: $MIGRATION_FILE"

# 1. Check SQL syntax
railway run psql -f $MIGRATION_FILE --dry-run 2>&1 | grep -i error
if [ $? -eq 0 ]; then
  echo "❌ SQL syntax errors found"
  exit 1
fi

# 2. Check for dangerous operations
DANGEROUS=$(grep -i "DROP\|TRUNCATE\|DELETE.*WHERE" $MIGRATION_FILE)
if [ -n "$DANGEROUS" ]; then
  echo "⚠️  Dangerous operations detected:"
  echo "$DANGEROUS"
  read -p "Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    exit 1
  fi
fi

# 3. Check for transactions
if ! grep -q "BEGIN" $MIGRATION_FILE; then
  echo "⚠️  No transaction found (BEGIN/COMMIT)"
  read -p "Continue without transaction? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    exit 1
  fi
fi

echo "✅ Validation passed"
```

**Usage:**
```bash
./scripts/validate-migration.sh database/migrations/001_new_feature.sql
```

## Best Practices Summary

### DO ✅

- Always backup before migrations
- Use transactions for consistency
- Test on staging first
- Version control migrations
- Use semantic migration names (`001_add_user_preferences.sql`)
- Add comments explaining complex migrations
- Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
- Create indexes concurrently on large tables
- Batch large data migrations
- Monitor database locks during migration

### DON'T ❌

- Run untested migrations on production
- Use `DROP TABLE` without backup
- Rename columns without backward compatibility
- Add NOT NULL without defaults on large tables
- Create regular indexes on tables with millions of rows
- Run migrations during peak traffic
- Ignore migration errors
- Skip rollback planning
- Use DDL without transactions (unless necessary)
- Forget to communicate downtime to users

## Emergency Procedures

### If Migration Fails Mid-Execution

```bash
# 1. Check if transaction is still open
railway connect postgres -c "SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';"

# 2. Check table locks
railway connect postgres -c "SELECT * FROM pg_locks WHERE NOT granted;"

# 3. If needed, kill blocking queries
railway connect postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = [PID];"

# 4. Restore from backup
railway run pg_restore --clean --if-exists -d $DATABASE_URL backup.dump

# 5. Verify restoration
railway connect postgres -c "\dt"
```

### If Application is Down After Migration

```bash
# 1. Check application logs
railway logs | tail -100

# 2. Check database connectivity
railway run node -e "require('pg').Client({ connectionString: process.env.DATABASE_URL }).connect().then(() => console.log('OK')).catch(console.error)"

# 3. Verify schema matches code
railway connect postgres -c "\d [table_name]"

# 4. Rollback migration if needed
railway connect postgres < migrations/rollback/001_revert.sql

# 5. Redeploy previous version
git revert HEAD
railway up
```

---

**Remember:** Database migrations are among the riskiest operations. When in doubt, choose safety over speed.
