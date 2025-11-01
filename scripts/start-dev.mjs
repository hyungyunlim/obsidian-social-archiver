#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('\n🚀 [Social Archiver] Starting Development Environment\n');

// Start processes
const processes = [];

// 1. Switch plugin to dev mode
console.log('1️⃣  Setting plugin to development mode...');
const setEnv = spawn('npm', ['run', 'env:dev'], {
  cwd: projectRoot,
  stdio: 'inherit'
});

setEnv.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Failed to set environment');
    process.exit(1);
  }

  console.log('\n2️⃣  Starting Workers API (http://localhost:8787)...');
  const workers = spawn('npm', ['run', 'dev:local'], {
    cwd: path.join(projectRoot, 'workers'),
    stdio: 'pipe'
  });

  workers.stdout.on('data', (data) => {
    if (data.toString().includes('Ready on http://localhost:8787')) {
      console.log('   ✅ Workers API is ready!');
    }
  });

  processes.push(workers);

  console.log('\n3️⃣  Starting Share Web (http://localhost:5173)...');
  const shareWeb = spawn('npm', ['run', 'dev'], {
    cwd: path.join(projectRoot, 'share-web'),
    stdio: 'pipe'
  });

  shareWeb.stdout.on('data', (data) => {
    if (data.toString().includes('Local:')) {
      console.log('   ✅ Share Web is ready!');
      console.log('\n✨ Development environment is ready!');
      console.log('\n📝 URLs:');
      console.log('   • Plugin API: http://localhost:8787');
      console.log('   • Share Web: http://localhost:5173');
      console.log('\n🔄 Please reload the Social Archiver plugin in Obsidian\n');
      console.log('Press Ctrl+C to stop all services\n');
    }
  });

  processes.push(shareWeb);
});

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down development environment...');
  processes.forEach(p => p.kill());
  process.exit(0);
});

process.on('exit', () => {
  processes.forEach(p => p.kill());
});