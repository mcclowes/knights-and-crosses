#!/usr/bin/env node

import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';
import crypto from 'crypto';

// Configuration from environment variables
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const TIME_RANGE_MINUTES = parseInt(process.env.TIME_RANGE_MINUTES || '30', 10);

// Label for auto-created issues
const AUTO_ISSUE_LABEL = 'vercel-error';
const DEDUP_LABEL_PREFIX = 'error-hash:';

// Initialize Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });
const [owner, repo] = GITHUB_REPOSITORY.split('/');

/**
 * Create a fingerprint hash for error deduplication
 */
function createErrorFingerprint(error) {
  // Extract key components for fingerprinting
  const errorType = error.type || 'unknown';
  const message = error.message || '';

  // Extract first line of stack trace if available (most specific location)
  let stackLocation = '';
  if (error.stack) {
    const stackLines = error.stack.split('\n').filter(line => line.trim());
    if (stackLines.length > 1) {
      stackLocation = stackLines[1].trim();
    }
  }

  // Create hash from type + message + stack location
  const fingerprint = `${errorType}:${message}:${stackLocation}`;
  return crypto.createHash('md5').update(fingerprint).digest('hex').substring(0, 8);
}

/**
 * Parse error from log entry
 */
function parseError(logEntry) {
  try {
    // Vercel log entries might have different formats
    const text = logEntry.message || logEntry.text || '';

    // Check if this is an error log
    if (!text.toLowerCase().includes('error') && logEntry.level !== 'error') {
      return null;
    }

    // Try to extract structured error information
    let errorData = {
      message: text,
      timestamp: logEntry.timestamp,
      deploymentId: logEntry.deploymentId,
      source: logEntry.source || 'unknown',
      type: 'Error',
      stack: null
    };

    // Try to parse JSON error if present
    const jsonMatch = text.match(/\{[\s\S]*"message"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        errorData = {
          ...errorData,
          message: parsed.message || text,
          type: parsed.name || parsed.type || 'Error',
          stack: parsed.stack || null
        };
      } catch (e) {
        // Not valid JSON, continue with text
      }
    }

    // Extract error type from text patterns
    const errorTypeMatch = text.match(/(\w+Error):/);
    if (errorTypeMatch) {
      errorData.type = errorTypeMatch[1];
    }

    // Extract stack trace from text
    const stackMatch = text.match(/at .+:\d+:\d+/g);
    if (stackMatch && stackMatch.length > 0) {
      errorData.stack = stackMatch.join('\n');
    }

    return errorData;
  } catch (e) {
    console.error('Error parsing log entry:', e);
    return null;
  }
}

/**
 * Fetch deployment logs from Vercel
 */
async function fetchVercelLogs() {
  console.log(`Fetching Vercel logs for the last ${TIME_RANGE_MINUTES} minutes...`);

  // Calculate time range
  const since = Date.now() - (TIME_RANGE_MINUTES * 60 * 1000);

  try {
    // First, get recent deployments
    let url = `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=10&since=${since}`;

    if (VERCEL_TEAM_ID) {
      url += `&teamId=${VERCEL_TEAM_ID}`;
    }

    const deploymentsResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`
      }
    });

    if (!deploymentsResponse.ok) {
      throw new Error(`Failed to fetch deployments: ${deploymentsResponse.status} ${deploymentsResponse.statusText}`);
    }

    const deploymentsData = await deploymentsResponse.json();
    const deployments = deploymentsData.deployments || [];

    console.log(`Found ${deployments.length} recent deployments`);

    if (deployments.length === 0) {
      console.log('No recent deployments found');
      return [];
    }

    // Fetch logs for each deployment
    const allErrors = [];

    for (const deployment of deployments) {
      console.log(`Fetching logs for deployment: ${deployment.uid}`);

      let logsUrl = `https://api.vercel.com/v2/deployments/${deployment.uid}/events`;
      if (VERCEL_TEAM_ID) {
        logsUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }

      const logsResponse = await fetch(logsUrl, {
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`
        }
      });

      if (!logsResponse.ok) {
        console.warn(`Failed to fetch logs for deployment ${deployment.uid}: ${logsResponse.status}`);
        continue;
      }

      const logsText = await logsResponse.text();

      // Parse NDJSON (newline-delimited JSON)
      const logLines = logsText.trim().split('\n').filter(line => line.trim());

      for (const line of logLines) {
        try {
          const logEntry = JSON.parse(line);
          const error = parseError(logEntry);

          if (error) {
            error.deploymentUrl = deployment.url;
            error.deploymentId = deployment.uid;
            allErrors.push(error);
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }

    console.log(`Found ${allErrors.length} error(s) in logs`);
    return allErrors;

  } catch (error) {
    console.error('Error fetching Vercel logs:', error);
    throw error;
  }
}

/**
 * Check if an issue already exists for this error fingerprint
 */
async function findExistingIssue(fingerprint) {
  try {
    const hashLabel = `${DEDUP_LABEL_PREFIX}${fingerprint}`;

    // Search for open issues with this error hash
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      labels: hashLabel,
      state: 'open'
    });

    return issues.length > 0 ? issues[0] : null;
  } catch (error) {
    console.error('Error searching for existing issue:', error);
    return null;
  }
}

/**
 * Ensure required labels exist
 */
async function ensureLabelsExist() {
  const labels = [
    {
      name: AUTO_ISSUE_LABEL,
      description: 'Automatically created from Vercel error logs',
      color: 'e11d21'
    }
  ];

  for (const label of labels) {
    try {
      await octokit.issues.getLabel({
        owner,
        repo,
        name: label.name
      });
    } catch (error) {
      if (error.status === 404) {
        // Label doesn't exist, create it
        try {
          await octokit.issues.createLabel({
            owner,
            repo,
            name: label.name,
            description: label.description,
            color: label.color
          });
          console.log(`Created label: ${label.name}`);
        } catch (createError) {
          console.error(`Failed to create label ${label.name}:`, createError.message);
        }
      }
    }
  }
}

/**
 * Create a GitHub issue for an error
 */
async function createIssueForError(error) {
  const fingerprint = createErrorFingerprint(error);
  const hashLabel = `${DEDUP_LABEL_PREFIX}${fingerprint}`;

  // Check if issue already exists
  const existingIssue = await findExistingIssue(fingerprint);

  if (existingIssue) {
    console.log(`Issue already exists for error ${fingerprint}: #${existingIssue.number}`);

    // Add a comment with the new occurrence
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: existingIssue.number,
      body: `
## New Occurrence

**Timestamp:** ${new Date(error.timestamp).toISOString()}
**Deployment:** ${error.deploymentUrl || error.deploymentId}
**Source:** ${error.source}

This error occurred again. The issue remains open.
      `.trim()
    });

    return existingIssue;
  }

  // Create new issue
  const issueTitle = `[Vercel Error] ${error.type}: ${error.message.substring(0, 100)}`;

  const issueBody = `
## Error Details

**Type:** ${error.type}
**Message:** ${error.message}
**Timestamp:** ${new Date(error.timestamp).toISOString()}
**Deployment:** ${error.deploymentUrl || error.deploymentId}
**Source:** ${error.source}

${error.stack ? `### Stack Trace\n\`\`\`\n${error.stack}\n\`\`\`` : ''}

---

**Error Hash:** \`${fingerprint}\`

This issue was automatically created from Vercel error logs.
  `.trim();

  try {
    const { data: issue } = await octokit.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels: [AUTO_ISSUE_LABEL, hashLabel, 'bug']
    });

    console.log(`Created issue #${issue.number} for error ${fingerprint}`);
    return issue;
  } catch (error) {
    console.error('Failed to create issue:', error);

    // If label creation failed, try without the hash label
    if (error.message.includes('Label does not exist')) {
      const { data: issue } = await octokit.issues.create({
        owner,
        repo,
        title: issueTitle,
        body: issueBody,
        labels: [AUTO_ISSUE_LABEL, 'bug']
      });

      console.log(`Created issue #${issue.number} (without hash label)`);
      return issue;
    }

    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  // Validate required environment variables
  if (!VERCEL_TOKEN) {
    console.error('VERCEL_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!VERCEL_PROJECT_ID) {
    console.error('VERCEL_PROJECT_ID environment variable is required');
    process.exit(1);
  }

  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!GITHUB_REPOSITORY) {
    console.error('GITHUB_REPOSITORY environment variable is required');
    process.exit(1);
  }

  console.log('=== Vercel Log Monitor ===');
  console.log(`Repository: ${GITHUB_REPOSITORY}`);
  console.log(`Project ID: ${VERCEL_PROJECT_ID}`);
  console.log(`Time Range: ${TIME_RANGE_MINUTES} minutes`);
  console.log('');

  try {
    // Ensure labels exist
    await ensureLabelsExist();

    // Fetch logs
    const errors = await fetchVercelLogs();

    if (errors.length === 0) {
      console.log('No errors found in logs');
      return;
    }

    // Group errors by fingerprint to avoid creating multiple issues
    const errorsByFingerprint = new Map();

    for (const error of errors) {
      const fingerprint = createErrorFingerprint(error);

      if (!errorsByFingerprint.has(fingerprint)) {
        errorsByFingerprint.set(fingerprint, []);
      }

      errorsByFingerprint.get(fingerprint).push(error);
    }

    console.log(`Found ${errorsByFingerprint.size} unique error(s)`);
    console.log('');

    // Create issues for unique errors
    const createdIssues = [];

    for (const [fingerprint, errorGroup] of errorsByFingerprint) {
      console.log(`Processing error group ${fingerprint} (${errorGroup.length} occurrence(s))`);

      // Use the first error in the group to create the issue
      const error = errorGroup[0];
      const issue = await createIssueForError(error);

      if (issue) {
        createdIssues.push(issue);
      }

      // If there are multiple occurrences, add them as comments
      if (errorGroup.length > 1) {
        for (let i = 1; i < errorGroup.length; i++) {
          const additionalError = errorGroup[i];

          if (issue) {
            await octokit.issues.createComment({
              owner,
              repo,
              issue_number: issue.number,
              body: `
**Additional Occurrence #${i}**

**Timestamp:** ${new Date(additionalError.timestamp).toISOString()}
**Deployment:** ${additionalError.deploymentUrl || additionalError.deploymentId}
              `.trim()
            });
          }
        }
      }
    }

    console.log('');
    console.log('=== Summary ===');
    console.log(`Total errors found: ${errors.length}`);
    console.log(`Unique errors: ${errorsByFingerprint.size}`);
    console.log(`Issues created/updated: ${createdIssues.length}`);

  } catch (error) {
    console.error('Error in main execution:', error);
    process.exit(1);
  }
}

// Run main function
main();
