import { mkdir, copyFile } from 'fs/promises';
import path from 'path';

const DEFAULT_OBSIDIAN_PATH = '/Users/hyungyunlim/Library/Mobile Documents/iCloud~md~obsidian/Documents/test/.obsidian';
const obRoot = process.env.SOCIAL_ARCHIVER_TEST_VAULT ?? DEFAULT_OBSIDIAN_PATH;
const pluginId = 'obsidian-social-archiver';
const pluginDir = path.join(obRoot, 'plugins', pluginId);

const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];

async function copyFiles() {
  console.log(`\n🚀 [Social Archiver] Deploying to test vault...`);
  console.log(`📂 Target: ${pluginDir}\n`);

  await mkdir(pluginDir, { recursive: true });

  await Promise.all(
    filesToCopy.map(async (file) => {
      const src = path.join(process.cwd(), file);
      const dest = path.join(pluginDir, file);
      try {
        await copyFile(src, dest);
        console.log(`  ✅ ${file}`);
      } catch (error) {
        console.log(`  ⚠️  ${file} (not found, skipping)`);
      }
    })
  );

  console.log('\n✨ Done! Please reload the plugin in Obsidian.');
  console.log('   → Settings → Community Plugins → Social Archiver → Reload\n');
}

copyFiles().catch((error) => {
  console.error('❌ [deploy] Failed to copy files:', error);
  process.exitCode = 1;
});
