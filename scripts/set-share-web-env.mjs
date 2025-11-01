#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shareWebRoot = path.join(__dirname, '..', 'share-web');
const envPath = path.join(shareWebRoot, '.env');

const ENVIRONMENTS = {
  dev: {
    VITE_API_URL: 'http://localhost:8787',
    description: 'Local development'
  },
  prod: {
    VITE_API_URL: 'https://social-archiver-api.junlim.org',
    description: 'Production'
  }
};

async function setEnvironment(env) {
  if (!ENVIRONMENTS[env]) {
    console.error(`❌ Unknown environment: ${env}`);
    console.log('Available environments:', Object.keys(ENVIRONMENTS).join(', '));
    process.exit(1);
  }

  try {
    const envConfig = ENVIRONMENTS[env];

    // Create .env content
    const envContent = `# Social Archiver Share Web - Environment Variables

# API Configuration
# Environment: ${env.toUpperCase()} - ${envConfig.description}
VITE_API_URL=${envConfig.VITE_API_URL}
`;

    // Write .env file
    await writeFile(envPath, envContent, 'utf-8');

    console.log(`\n🌐 [Share Web] Environment switched to: ${env.toUpperCase()}`);
    console.log(`   📍 ${envConfig.description}`);
    console.log(`   🔗 API URL: ${envConfig.VITE_API_URL}`);
    console.log('\n✨ Restart the dev server if it\'s running\n');

  } catch (error) {
    console.error(`❌ Failed to update environment:`, error.message);
    process.exit(1);
  }
}

// Get environment from command line
const env = process.argv[2];

if (!env) {
  console.log('\n📋 [Share Web] Environment Switcher');
  console.log('Usage: node scripts/set-share-web-env.mjs <environment>\n');
  console.log('Available environments:');
  Object.entries(ENVIRONMENTS).forEach(([key, config]) => {
    console.log(`  • ${key}: ${config.description} (${config.VITE_API_URL})`);
  });
  process.exit(0);
}

setEnvironment(env);