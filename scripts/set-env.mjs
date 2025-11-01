#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const DEFAULT_OBSIDIAN_PATH = '/Users/hyungyunlim/vaults/test/.obsidian';
const obRoot = process.env.SOCIAL_ARCHIVER_TEST_VAULT ?? DEFAULT_OBSIDIAN_PATH;
const pluginId = 'obsidian-social-archiver';
const dataPath = path.join(obRoot, 'plugins', pluginId, 'data.json');

const ENVIRONMENTS = {
  dev: {
    workerUrl: 'http://localhost:8787',
    debugMode: true,
    enableSharing: true,
    description: 'Local development'
  },
  prod: {
    workerUrl: 'https://social-archiver-api.junlim.org',
    debugMode: false,
    enableSharing: true,
    description: 'Production'
  },
  staging: {
    workerUrl: 'https://social-archiver-api-staging.junlim.org',
    debugMode: true,
    enableSharing: true,
    description: 'Staging environment'
  }
};

async function setEnvironment(env) {
  if (!ENVIRONMENTS[env]) {
    console.error(`❌ Unknown environment: ${env}`);
    console.log('Available environments:', Object.keys(ENVIRONMENTS).join(', '));
    process.exit(1);
  }

  try {
    // Read current data.json
    const dataContent = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(dataContent);

    // Update settings for the environment
    const envConfig = ENVIRONMENTS[env];
    Object.assign(data, {
      workerUrl: envConfig.workerUrl,
      debugMode: envConfig.debugMode,
      enableSharing: envConfig.enableSharing
    });

    // Write back
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`\n🚀 [Social Archiver] Environment switched to: ${env.toUpperCase()}`);
    console.log(`   📍 ${envConfig.description}`);
    console.log(`   🔗 Worker URL: ${envConfig.workerUrl}`);
    console.log(`   🐛 Debug Mode: ${envConfig.debugMode ? 'ON' : 'OFF'}`);
    console.log(`   🔗 Sharing: ${envConfig.enableSharing ? 'ON' : 'OFF'}`);
    console.log('\n✨ Please reload the plugin in Obsidian:');
    console.log('   → Settings → Community Plugins → Social Archiver → Reload\n');

    // Also update share-web .env
    const shareWebEnvPath = path.join(__dirname, '..', 'share-web', '.env');
    try {
      const apiUrl = env === 'dev'
        ? 'http://localhost:8787'
        : 'https://social-archiver-api.junlim.org';

      let envContent = await readFile(shareWebEnvPath, 'utf-8');
      envContent = envContent.replace(
        /VITE_API_URL=.*/,
        `VITE_API_URL=${apiUrl}`
      );
      await writeFile(shareWebEnvPath, envContent, 'utf-8');
      console.log(`   ✅ Updated share-web/.env to ${env} mode\n`);
    } catch (e) {
      // Ignore if share-web/.env doesn't exist
    }

    // Display Worker API instructions
    console.log('📦 Worker API Instructions:');
    if (env === 'dev') {
      console.log('   Start local Worker: cd workers && npm run dev:local');
    } else {
      console.log('   Worker API will use production endpoint');
    }
    console.log('');

  } catch (error) {
    console.error(`❌ Failed to update environment:`, error.message);
    console.log(`\n💡 Make sure the plugin is installed at: ${dataPath}`);
    process.exit(1);
  }
}

// Get environment from command line
const env = process.argv[2];

if (!env) {
  console.log('\n📋 [Social Archiver] Environment Switcher');
  console.log('Usage: npm run env:<environment>\n');
  console.log('Available environments:');
  Object.entries(ENVIRONMENTS).forEach(([key, config]) => {
    console.log(`  • ${key}: ${config.description} (${config.workerUrl})`);
  });
  console.log('\nExamples:');
  console.log('  npm run env:dev    # Switch to local development');
  console.log('  npm run env:prod   # Switch to production\n');
  process.exit(0);
}

setEnvironment(env);