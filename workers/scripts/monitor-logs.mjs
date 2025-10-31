#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgGreen: '\x1b[42m',
};

// Configuration from command line args
const args = process.argv.slice(2);
const filterLevel = args.find(arg => ['error', 'warn', 'info', 'debug'].includes(arg.toLowerCase()));
const showRaw = args.includes('--raw');
const showTimestamp = !args.includes('--no-timestamp');
const compact = args.includes('--compact');
const maxStringLength = args.includes('--full') ? Infinity : 500;
const maxDepth = args.includes('--deep') ? 10 : 4;

/**
 * Format timestamp to readable format
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${colors.gray}${hours}:${minutes}:${seconds}.${ms}${colors.reset}`;
}

/**
 * Get color for log level
 */
function getLevelColor(level) {
  if (!level) return colors.white;
  const levelLower = level.toLowerCase();

  switch (levelLower) {
    case 'error':
    case 'err':
      return colors.red;
    case 'warn':
    case 'warning':
      return colors.yellow;
    case 'info':
      return colors.green;
    case 'debug':
      return colors.cyan;
    case 'log':
      return colors.blue;
    default:
      return colors.white;
  }
}

/**
 * Format log level badge
 */
function formatLevel(level) {
  if (!level) return '';
  const levelUpper = level.toUpperCase().padEnd(5);
  const color = getLevelColor(level);
  return `${color}${colors.bright}[${levelUpper}]${colors.reset}`;
}

/**
 * Check if an object looks like an indexed object (e.g., {"0": "a", "1": "b"})
 * This happens when strings or arrays are incorrectly serialized
 */
function isIndexedObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) return false;

  // Check if all keys are sequential numbers starting from 0
  const numericKeys = keys.map(k => parseInt(k, 10));
  if (numericKeys.some(k => isNaN(k))) return false;

  numericKeys.sort((a, b) => a - b);
  return numericKeys.every((val, idx) => val === idx);
}

/**
 * Reconstruct original data from indexed object
 */
function reconstructFromIndexedObject(obj) {
  if (!isIndexedObject(obj)) return obj;

  const keys = Object.keys(obj).map(k => parseInt(k, 10)).sort((a, b) => a - b);
  const values = keys.map(k => obj[String(k)]);

  // Check if all values are single characters (likely a string)
  if (values.every(v => typeof v === 'string' && v.length === 1)) {
    return values.join('');
  }

  // Otherwise, return as array
  return values;
}

/**
 * Truncate string if too long
 */
function truncateString(str, maxLength = maxStringLength) {
  if (maxLength === Infinity || str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + `... (${str.length - maxLength} more chars)`;
}

/**
 * Recursively clean an object by reconstructing indexed objects
 */
function cleanObject(obj, depth = 0) {
  if (obj === null || obj === undefined) return obj;

  // Stop if we've gone too deep
  if (depth > maxDepth) {
    return typeof obj === 'object' ? '[Object]' : obj;
  }

  // Check if this object itself is an indexed object
  if (isIndexedObject(obj)) {
    const reconstructed = reconstructFromIndexedObject(obj);
    // If it's a string, truncate it
    if (typeof reconstructed === 'string') {
      return truncateString(reconstructed);
    }
    return reconstructed;
  }

  // Truncate strings
  if (typeof obj === 'string') {
    return truncateString(obj);
  }

  // If it's an array, clean each element
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item, depth + 1));
  }

  // If it's an object, clean each property
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanObject(value, depth + 1);
    }
    return cleaned;
  }

  return obj;
}

/**
 * Safely stringify with proper handling of indexed objects
 */
function safeStringify(obj, indent = 2) {
  try {
    const cleaned = cleanObject(obj);
    return JSON.stringify(cleaned, null, indent);
  } catch (err) {
    return String(obj);
  }
}

/**
 * Try to parse and prettify JSON
 */
function tryParseJSON(str) {
  try {
    const obj = JSON.parse(str);
    return safeStringify(obj, 2);
  } catch {
    return str;
  }
}

/**
 * Format a single log line
 */
function formatLogLine(line) {
  if (!line || line.trim() === '') return null;

  // Skip wrangler metadata lines
  if (line.includes('Tailing logs') || line.includes('Connected to')) {
    return `${colors.dim}${line}${colors.reset}`;
  }

  try {
    // Try to parse as JSON (wrangler tail outputs JSON)
    const logEntry = JSON.parse(line);

    // Extract common fields
    const {
      timestamp,
      level,
      message,
      outcome,
      scriptName,
      ...rest
    } = logEntry;

    // Filter by level if specified
    if (filterLevel && level && level.toLowerCase() !== filterLevel.toLowerCase()) {
      return null;
    }

    // Show raw JSON if requested
    if (showRaw) {
      return safeStringify(logEntry, 2);
    }

    // Build formatted output
    const parts = [];

    // Timestamp
    if (showTimestamp && timestamp) {
      parts.push(formatTimestamp(timestamp));
    }

    // Level
    if (level) {
      parts.push(formatLevel(level));
    }

    // Outcome (for request logs)
    if (outcome) {
      const outcomeColor = outcome === 'ok' ? colors.green : colors.red;
      parts.push(`${outcomeColor}[${outcome.toUpperCase()}]${colors.reset}`);
    }

    // Script name
    if (scriptName && !compact) {
      parts.push(`${colors.gray}(${scriptName})${colors.reset}`);
    }

    // Message
    if (message) {
      // Clean the message first
      const cleanedMessage = cleanObject(message);

      // Check if message is array or object
      const formattedMessage = Array.isArray(cleanedMessage)
        ? cleanedMessage.join(' ')
        : cleanedMessage;

      const messageStr = typeof formattedMessage === 'object'
        ? safeStringify(formattedMessage, 2)
        : String(formattedMessage);

      parts.push(messageStr);
    }

    // Additional fields
    if (!compact && Object.keys(rest).length > 0) {
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([key]) =>
          !['eventTimestamp', 'event'].includes(key)
        )
      );
      if (Object.keys(filtered).length > 0) {
        const cleanedFiltered = cleanObject(filtered);
        parts.push(`\n${colors.dim}${safeStringify(cleanedFiltered, 2)}${colors.reset}`);
      }
    }

    return parts.join(' ');
  } catch {
    // Not JSON, just format as plain text
    if (line.includes('ERROR') || line.includes('Error')) {
      return `${colors.red}${line}${colors.reset}`;
    } else if (line.includes('WARN') || line.includes('Warning')) {
      return `${colors.yellow}${line}${colors.reset}`;
    } else if (line.includes('INFO')) {
      return `${colors.green}${line}${colors.reset}`;
    }
    return line;
  }
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${colors.bright}Worker Log Monitor${colors.reset}
${colors.dim}Enhanced log viewing for Cloudflare Workers${colors.reset}

${colors.bright}Usage:${colors.reset}
  npm run logs [options] [level]

${colors.bright}Levels:${colors.reset}
  error    Show only error logs
  warn     Show only warning logs
  info     Show only info logs
  debug    Show only debug logs

${colors.bright}Options:${colors.reset}
  --raw           Show raw JSON output
  --no-timestamp  Hide timestamps
  --compact       Hide extra metadata
  --full          Show full strings without truncation
  --deep          Show deeper object nesting (default: 4 levels)
  --help          Show this help message

${colors.bright}Examples:${colors.reset}
  npm run logs                    ${colors.dim}# Show all logs with formatting${colors.reset}
  npm run logs error              ${colors.dim}# Show only errors${colors.reset}
  npm run logs -- --compact       ${colors.dim}# Show compact logs${colors.reset}
  npm run logs -- --raw           ${colors.dim}# Show raw JSON${colors.reset}
  npm run logs -- --full          ${colors.dim}# Show full strings (no truncation)${colors.reset}
  npm run logs -- --deep          ${colors.dim}# Show deeper nested objects${colors.reset}
  npm run logs error -- --compact ${colors.dim}# Compact error logs only${colors.reset}
`);
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

// Print header
console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════╗
║        Worker Log Monitor - Starting...               ║
╚═══════════════════════════════════════════════════════╝
${colors.reset}`);

if (filterLevel) {
  console.log(`${colors.dim}Filtering: ${formatLevel(filterLevel)}${colors.reset}\n`);
}

// Spawn wrangler tail process
const wrangler = spawn('wrangler', ['tail'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  cwd: process.cwd()
});

// Process stdout
const rlStdout = createInterface({
  input: wrangler.stdout,
  crlfDelay: Infinity
});

rlStdout.on('line', (line) => {
  const formatted = formatLogLine(line);
  if (formatted !== null) {
    console.log(formatted);
  }
});

// Process stderr (usually wrangler status messages)
const rlStderr = createInterface({
  input: wrangler.stderr,
  crlfDelay: Infinity
});

rlStderr.on('line', (line) => {
  console.error(`${colors.dim}${line}${colors.reset}`);
});

// Handle process exit
wrangler.on('close', (code) => {
  console.log(`\n${colors.dim}Log monitor exited with code ${code}${colors.reset}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.dim}Stopping log monitor...${colors.reset}`);
  wrangler.kill('SIGINT');
});

// Handle errors
wrangler.on('error', (err) => {
  console.error(`${colors.red}Error starting wrangler tail: ${err.message}${colors.reset}`);
  console.error(`${colors.dim}Make sure wrangler is installed and you're logged in${colors.reset}`);
  process.exit(1);
});
