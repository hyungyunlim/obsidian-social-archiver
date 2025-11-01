#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('\n🚀 [Social Archiver] Full Deployment Script\n');

// Function to run command and wait for completion
async function runCommand(cmd, args, cwd, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n${description}...`);
    const child = spawn(cmd, args, {
      cwd: cwd || projectRoot,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${description} failed with code ${code}`));
      } else {
        console.log(`✅ ${description} completed`);
        resolve();
      }
    });
  });
}

async function deploy(returnToDev = false) {
  try {
    // Step 1: Switch everything to production mode
    console.log('1️⃣  Switching to production environment...');
    await runCommand('npm', ['run', 'env:prod-all'], projectRoot, 'Environment switch');

    // Step 2: Build and deploy Obsidian plugin
    console.log('\n2️⃣  Building and deploying Obsidian plugin...');
    await runCommand('npm', ['run', 'build:deploy'], projectRoot, 'Plugin build & deploy');

    // Step 3: Deploy Workers API to Cloudflare
    console.log('\n3️⃣  Deploying Workers API to Cloudflare...');
    await runCommand('npm', ['run', 'deploy:prod'], path.join(projectRoot, 'workers'), 'Workers API deployment');

    // Step 4: Deploy Share Web to Cloudflare Pages
    console.log('\n4️⃣  Deploying Share Web to Cloudflare Pages...');
    await runCommand('npm', ['run', 'build:deploy'], path.join(projectRoot, 'share-web'), 'Share Web deployment');

    console.log('\n✨ Deployment Complete!\n');
    console.log('📋 Deployed components:');
    console.log('   ✅ Obsidian Plugin (to vault)');
    console.log('   ✅ Workers API (https://social-archiver-api.junlim.org)');
    console.log('   ✅ Share Web (https://social-archive.junlim.org)');
    console.log('\n⚠️  Note: Changes may take a few minutes to propagate on Cloudflare\n');

    // Return to dev environment if requested
    if (returnToDev) {
      console.log('🔄 Switching back to development environment...');
      await runCommand('npm', ['run', 'env:dev-all'], projectRoot, 'Switch to dev');
      console.log('✅ Returned to development environment\n');
      console.log('💡 You can start development servers with: npm run dev:all\n');
    } else {
      console.log('💡 To switch back to development mode, run: npm run env:dev-all\n');
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.log('\n🔄 Attempting to restore development environment...');

    try {
      await runCommand('npm', ['run', 'env:dev-all'], projectRoot, 'Restore dev environment');
      console.log('✅ Development environment restored');
    } catch (restoreError) {
      console.error('⚠️  Failed to restore dev environment:', restoreError.message);
    }

    process.exit(1);
  }
}

// Add confirmation prompt
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check for command line arguments
const args = process.argv.slice(2);
const returnToDev = args.includes('--return-to-dev') || args.includes('-d');
const skipConfirm = args.includes('--yes') || args.includes('-y');

if (skipConfirm) {
  deploy(returnToDev);
} else {
  console.log('⚠️  This will deploy to PRODUCTION environments:');
  console.log('   • Obsidian Plugin → Your vault');
  console.log('   • Workers API → Cloudflare Workers (production)');
  console.log('   • Share Web → Cloudflare Pages (production)');

  if (returnToDev) {
    console.log('\n📝 After deployment, environment will switch back to development mode.');
  }
  console.log('');

  rl.question('Are you sure you want to deploy? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      rl.close();
      deploy(returnToDev);
    } else {
      console.log('\n❌ Deployment cancelled\n');
      rl.close();
      process.exit(0);
    }
  });
}