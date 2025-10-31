#!/usr/bin/env node

/**
 * Cross-platform deployment script for Social Archiver
 * Deploys Worker API and SvelteKit app with change detection
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Configuration
const CONFIG = {
  projectName: 'obsidian-social-archiver',
  workerPath: join(__dirname, '../../worker'),
  shareWebPath: join(__dirname, '..'),
  productionUrl: 'https://social-archive.junlim.org'
};

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.green}🚀 ${msg}${colors.reset}`)
};

function exec(command, options = {}) {
  try {
    execSync(command, {
      stdio: 'inherit',
      ...options
    });
    return true; // Return true on success
  } catch (error) {
    return false; // Return false on failure
  }
}

function execSilent(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options
    }).trim();
  } catch (error) {
    return null;
  }
}

function hasGitChanges(path) {
  const changes = execSilent(`git diff HEAD --name-only -- "${path}" 2>/dev/null | wc -l`);
  const staged = execSilent(`git diff --cached --name-only -- "${path}" 2>/dev/null | wc -l`);
  const untracked = execSilent(`git ls-files --others --exclude-standard -- "${path}" 2>/dev/null | wc -l`);

  return (parseInt(changes) > 0 || parseInt(staged) > 0 || parseInt(untracked) > 0);
}

function getLastCommit(path) {
  return execSilent(`git log -1 --pretty=format:"%h" -- "${path}" 2>/dev/null`) || 'none';
}

async function deployWorker(force = false) {
  if (!existsSync(CONFIG.workerPath)) {
    log.warning('Worker directory not found, skipping Worker deployment');
    return false;
  }

  const lastCommit = getLastCommit(CONFIG.workerPath);

  if (!force && !hasGitChanges(CONFIG.workerPath)) {
    log.success(`Worker API unchanged (last commit: ${lastCommit})`);
    return false;
  }

  log.section(`Deploying Worker API (last commit: ${lastCommit})`);

  process.chdir(CONFIG.workerPath);

  // Check for package.json
  if (existsSync('package.json')) {
    log.info('Building Worker API...');

    // Install dependencies if node_modules doesn't exist
    if (!existsSync('node_modules')) {
      log.info('Installing dependencies...');
      exec('npm install');
    }

    // Build
    if (!exec('npm run build')) {
      log.error('Worker build failed');
      return false;
    }
  }

  // Deploy with wrangler
  if (existsSync('wrangler.toml')) {
    log.info('Deploying to Cloudflare Workers...');
    if (exec('npx wrangler deploy --minify')) {
      log.success('Worker API deployed successfully');
      return true;
    } else {
      log.error('Worker deployment failed');
      return false;
    }
  } else {
    log.warning('No wrangler.toml found, skipping Worker deployment');
    return false;
  }
}

async function deploySvelteKit(force = false) {
  process.chdir(CONFIG.shareWebPath);

  const srcPath = join(CONFIG.shareWebPath, 'src');
  const lastCommit = getLastCommit(srcPath);

  const hasChanges = hasGitChanges(srcPath) ||
                     hasGitChanges(join(CONFIG.shareWebPath, 'package.json')) ||
                     hasGitChanges(join(CONFIG.shareWebPath, 'svelte.config.js'));

  if (!force && !hasChanges) {
    log.success(`SvelteKit app unchanged (last commit: ${lastCommit})`);
    return false;
  }

  log.section(`Deploying SvelteKit app (last commit: ${lastCommit})`);

  // Install dependencies if needed
  if (!existsSync('node_modules')) {
    log.info('Installing dependencies...');
    exec('npm install');
  }

  // Build
  log.info('Building SvelteKit app...');
  if (!exec('npm run build')) {
    log.error('Build failed');
    return false;
  }

  log.success('Build successful');

  // Deploy to Cloudflare Pages
  log.info('Deploying to Cloudflare Pages...');
  const deployDate = new Date().toISOString().replace('T', ' ').split('.')[0];

  // Ensure we're in the correct directory
  const currentDir = process.cwd();
  if (!currentDir.endsWith('share-web')) {
    process.chdir(CONFIG.shareWebPath);
  }

  const deployCommand = `npx wrangler pages deploy .svelte-kit/cloudflare --project-name="${CONFIG.projectName}" --commit-dirty=true --commit-message="Deploy: ${deployDate}"`;

  if (exec(deployCommand)) {
    log.success('SvelteKit app deployed successfully');
    return true;
  } else {
    log.error('Deployment to Cloudflare Pages failed');
    log.warning('You can try deploying manually with:');
    console.log(`  cd ${CONFIG.shareWebPath}`);
    console.log(`  ${deployCommand}`);
    return false;
  }
}

async function checkUncommittedChanges() {
  const status = execSilent('git status --porcelain');
  if (status) {
    log.warning('You have uncommitted changes');

    // In non-interactive environments, continue
    if (!process.stdin.isTTY) {
      log.info('Continuing with deployment (non-interactive mode)');
      return true;
    }

    // In interactive environments, ask for confirmation
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('Continue with deployment? (y/n) ', (answer) => {
        readline.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const testAfter = args.includes('--test');
  const workerOnly = args.includes('--worker');
  const pagesOnly = args.includes('--pages');

  log.section('Starting Social Archiver deployment...');

  // Check for uncommitted changes
  if (!await checkUncommittedChanges()) {
    log.error('Deployment cancelled');
    process.exit(1);
  }

  let workerDeployed = false;
  let svelteKitDeployed = false;

  // Deploy Worker if not pages-only
  if (!pagesOnly) {
    try {
      workerDeployed = await deployWorker(force);
    } catch (error) {
      log.error(`Worker deployment error: ${error.message}`);
    }
  }

  // Deploy SvelteKit if not worker-only
  if (!workerOnly) {
    try {
      svelteKitDeployed = await deploySvelteKit(force);
    } catch (error) {
      log.error(`SvelteKit deployment error: ${error.message}`);
    }
  }

  // Summary
  log.section('Deployment Summary:');
  console.log(`  • Worker API: ${workerDeployed ? colors.green + 'Deployed' : 'No changes'}${colors.reset}`);
  console.log(`  • SvelteKit: ${svelteKitDeployed ? colors.green + 'Deployed' : 'No changes'}${colors.reset}`);

  // URLs
  log.section('Deployment URLs:');
  console.log(`  • Production: ${CONFIG.productionUrl}`);
  console.log(`  • Preview: Check Cloudflare Pages dashboard`);

  // Run tests if requested
  if (testAfter && (workerDeployed || svelteKitDeployed)) {
    log.section('Running post-deployment tests...');
    process.chdir(CONFIG.shareWebPath);

    if (!exec('npm run test:run')) {
      log.warning('Some tests failed');
    }
  }

  log.success('\n✨ Deployment complete!');

  // Return success status
  const success = workerDeployed || svelteKitDeployed || (!workerOnly && !pagesOnly);
  process.exit(success ? 0 : 1);
}

// Run the script
main().catch(error => {
  log.error(`Deployment failed: ${error.message}`);
  process.exit(1);
});