# Vercel Log Monitor - Automatic GitHub Issue Creation

This automation fetches error logs from Vercel deployments and automatically creates GitHub issues with intelligent deduplication.

## Features

- **Automatic Error Detection**: Monitors Vercel deployment logs for errors
- **Smart Deduplication**: Creates error fingerprints to avoid duplicate issues
- **Scheduled Monitoring**: Runs every 30 minutes via GitHub Actions
- **Occurrence Tracking**: Adds comments to existing issues when errors recur
- **Manual Trigger**: Can be manually triggered with custom time ranges

## How It Works

1. **Fetch Logs**: Retrieves logs from recent Vercel deployments
2. **Parse Errors**: Identifies error entries in logs
3. **Create Fingerprint**: Generates unique hash based on error type, message, and stack location
4. **Check Duplicates**: Searches for existing open issues with the same error hash
5. **Create/Update Issue**: Creates new issue or adds comment to existing one

## Setup Instructions

### 1. Get Your Vercel Credentials

#### Get Vercel Token:

1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions Log Monitor")
4. Set scope to your team/account
5. Copy the token

#### Get Project ID:

```bash
# Option 1: From Vercel Dashboard URL
# URL format: https://vercel.com/{team}/{project}/settings
# The project ID is in Settings > General

# Option 2: Using Vercel CLI
npx vercel ls
# Find your project and note the ID
```

#### Get Team ID (if using team):

```bash
# Using Vercel CLI
npx vercel teams ls
# Note your team ID
```

### 2. Add GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add each of the following:

| Secret Name         | Description                         | Required      |
| ------------------- | ----------------------------------- | ------------- |
| `VERCEL_TOKEN`      | Your Vercel API token               | Yes           |
| `VERCEL_PROJECT_ID` | Your Vercel project ID              | Yes           |
| `VERCEL_TEAM_ID`    | Your Vercel team ID (if applicable) | If using team |

**Note:** `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### 3. Enable the Workflow

The workflow is located at `.github/workflows/vercel-log-monitor.yml` and will:

- Run automatically every 30 minutes
- Check for errors in the last 30 minutes of logs
- Can be manually triggered with custom time ranges

### 4. Manual Triggering

To manually trigger the workflow:

1. Go to **Actions** tab in your repository
2. Select "Vercel Log Monitor" workflow
3. Click **Run workflow**
4. Optionally specify a custom time range (in minutes)

## How Deduplication Works

### Error Fingerprinting

Each error is fingerprinted using:

```
MD5( errorType + errorMessage + firstStackTraceLine )
```

Example:

- Error: `TypeError: Cannot read property 'foo' of undefined`
- Stack: `at GameService.findGame (/src/server/services/GameService.js:123:45)`
- Fingerprint: `a1b2c3d4` (8-character hash)

### Label-Based Tracking

Issues are tagged with:

- `vercel-error` - All auto-created issues
- `error-hash:a1b2c3d4` - Specific error fingerprint
- `bug` - Standard bug label

### Duplicate Detection

When a new error is found:

1. Calculate its fingerprint
2. Search for open issues with matching `error-hash:*` label
3. If found: Add comment with new occurrence details
4. If not found: Create new issue

## Issue Format

### New Issue

```markdown
[Vercel Error] TypeError: Cannot read property 'foo' of undefined

## Error Details

**Type:** TypeError
**Message:** Cannot read property 'foo' of undefined
**Timestamp:** 2025-10-24T15:30:00.000Z
**Deployment:** your-app-abc123.vercel.app
**Source:** api/socket

### Stack Trace
```

at GameService.findGame (/src/server/services/GameService.js:123:45)
at async handler (/pages/api/socket.ts:67:12)

```

---

**Error Hash:** `a1b2c3d4`

This issue was automatically created from Vercel logs.
```

### Recurring Error Comment

```markdown
## New Occurrence

**Timestamp:** 2025-10-24T16:00:00.000Z
**Deployment:** your-app-xyz789.vercel.app
**Source:** api/socket

This error occurred again. The issue remains open.
```

## Customization

### Adjust Monitoring Frequency

Edit `.github/workflows/vercel-log-monitor.yml`:

```yaml
schedule:
  - cron: "*/30 * * * *" # Every 30 minutes
  # Change to:
  - cron: "0 * * * *" # Every hour
  - cron: "*/15 * * * *" # Every 15 minutes
```

### Adjust Time Range

Edit the workflow default time range:

```yaml
inputs:
  time_range:
    default: "30" # Change this value (in minutes)
```

### Modify Error Parsing

Edit `.github/scripts/fetch-vercel-logs.js`:

- `parseError()` function - Customize error detection logic
- `createErrorFingerprint()` function - Change fingerprinting strategy

### Customize Issue Labels

Edit the script constants:

```javascript
const AUTO_ISSUE_LABEL = "vercel-error"; // Main label
const DEDUP_LABEL_PREFIX = "error-hash:"; // Fingerprint prefix
```

## Troubleshooting

### No Logs Fetched

**Problem:** Workflow runs but finds no logs.

**Solutions:**

- Verify `VERCEL_PROJECT_ID` is correct
- Check that deployments exist in the time range
- Ensure Vercel token has proper permissions
- If using team, verify `VERCEL_TEAM_ID` is set

### Authentication Errors

**Problem:** "Failed to fetch deployments: 401" or "403"

**Solutions:**

- Regenerate Vercel token
- Ensure token has access to the project/team
- Verify token is correctly set in GitHub secrets

### No Issues Created

**Problem:** Errors found but no issues created.

**Solutions:**

- Check workflow logs for error messages
- Verify `GITHUB_TOKEN` has write permissions
- Ensure repository settings allow GitHub Actions to create issues:
  - Settings > Actions > General > Workflow permissions > "Read and write permissions"

### Duplicate Issues Created

**Problem:** Multiple issues for same error.

**Solutions:**

- Check if `error-hash:*` labels are being created
- Verify deduplication logic in `findExistingIssue()`
- Issues may be closed - script only checks open issues

## Testing

### Test Manually

```bash
# Install dependencies
cd .github/scripts
npm install

# Set environment variables
export VERCEL_TOKEN="your-token"
export VERCEL_PROJECT_ID="your-project-id"
export VERCEL_TEAM_ID="your-team-id"  # Optional
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"
export TIME_RANGE_MINUTES="60"

# Run script
node fetch-vercel-logs.js
```

### Expected Output

```
=== Vercel Log Monitor ===
Repository: mcclowes/knights-and-crosses
Project ID: prj_xxxxxxxxxxxxx
Time Range: 30 minutes

Fetching Vercel logs for the last 30 minutes...
Found 3 recent deployments
Fetching logs for deployment: dpl_xxxxxxxxxxxxx
Found 5 error(s) in logs
Found 2 unique error(s)

Processing error group a1b2c3d4 (3 occurrence(s))
Created issue #42 for error a1b2c3d4
Processing error group e5f6g7h8 (2 occurrence(s))
Issue already exists for error e5f6g7h8: #38

=== Summary ===
Total errors found: 5
Unique errors: 2
Issues created/updated: 2
```

## Advanced Configuration

### Filter Specific Errors

Modify `parseError()` to ignore certain errors:

```javascript
function parseError(logEntry) {
  const error = /* ... parsing logic ... */;

  // Ignore specific errors
  if (error.message.includes('ECONNRESET')) {
    return null;
  }

  return error;
}
```

### Add Severity Levels

Tag issues based on error type:

```javascript
function getSeverity(error) {
  if (error.type.includes("Fatal")) return "critical";
  if (error.type.includes("TypeError")) return "high";
  return "medium";
}

// In createIssueForError()
labels: [AUTO_ISSUE_LABEL, hashLabel, "bug", `severity:${getSeverity(error)}`];
```

### Integration with Alerts

Add notifications when critical errors occur:

```javascript
// After creating issue
if (error.type.includes("Fatal")) {
  // Send Slack notification, PagerDuty alert, etc.
}
```

## FAQ

**Q: Will this create issues for old errors?**
A: No, it only checks logs from the specified time range (default: last 30 minutes).

**Q: What happens to closed issues?**
A: If an error recurs and its issue was closed, a new issue will be created.

**Q: Can I backfill old errors?**
A: Yes, manually trigger the workflow with a larger time range (e.g., 1440 for 24 hours).

**Q: Does this cost money?**
A: GitHub Actions are free for public repos, with generous limits for private repos. Vercel API is free.

**Q: How do I stop monitoring?**
A: Disable the workflow in `.github/workflows/vercel-log-monitor.yml` (add `workflow_dispatch:` only, remove `schedule:`).

## Contributing

To improve error detection, fingerprinting, or issue formatting:

1. Edit `.github/scripts/fetch-vercel-logs.js`
2. Test locally using the manual testing steps above
3. Submit a PR with your improvements

## Resources

- [Vercel API Documentation](https://vercel.com/docs/rest-api)
- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
