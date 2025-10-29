#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test vault path
const VAULT_PATH = '/Users/hyungyunlim/Library/Mobile Documents/iCloud~md~obsidian/Documents/test';
const ARCHIVE_PATH = path.join(VAULT_PATH, 'Social Archives');

/**
 * Format date to YYYY-MM-DD HH:mm in local timezone
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Convert date string to YYYY-MM-DD HH:mm format
 * Handles:
 * - "2024-10-29" -> "2024-10-29 00:00"
 * - "2025-10-28T12:26:22.812Z" -> "2025-10-28 21:26" (converted to local timezone)
 * - "2024-10-29 14:30" -> "2024-10-29 14:30" (no change)
 */
function convertDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  // Already in correct format (YYYY-MM-DD HH:mm)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // ISO 8601 format (2025-10-28T12:26:22.812Z)
  if (dateStr.includes('T') && (dateStr.includes('Z') || dateStr.includes('+'))) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return formatDate(date);
    }
  }

  // Date only format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Add midnight time
    return `${dateStr} 00:00`;
  }

  return null;
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatterText = frontmatterMatch[1];
  const lines = frontmatterText.split('\n');
  const frontmatter = {};

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      frontmatter[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return {
    frontmatter,
    startIndex: 0,
    endIndex: frontmatterMatch[0].length
  };
}

/**
 * Update YAML frontmatter in markdown content
 */
function updateFrontmatter(content, updates) {
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return content;
  }

  const { frontmatter, endIndex } = parsed;
  const updatedFrontmatter = { ...frontmatter, ...updates };

  // Generate new YAML
  const yamlLines = Object.entries(updatedFrontmatter)
    .map(([key, value]) => {
      // Quote values that contain colons or hashes
      if (typeof value === 'string' && (value.includes(':') || value.includes('#'))) {
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  const newFrontmatter = `---\n${yamlLines}\n---`;
  const remainingContent = content.slice(endIndex);

  return newFrontmatter + remainingContent;
}

/**
 * Process a single markdown file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      console.log(`⏭️  Skipped (no frontmatter): ${path.basename(filePath)}`);
      return false;
    }

    const { frontmatter } = parsed;
    const updates = {};
    let hasChanges = false;

    // Check and convert date fields
    const dateFields = ['published', 'archived', 'lastModified'];
    for (const field of dateFields) {
      if (frontmatter[field]) {
        const converted = convertDateFormat(frontmatter[field]);
        if (converted && converted !== frontmatter[field]) {
          updates[field] = converted;
          hasChanges = true;
          console.log(`  📅 ${field}: "${frontmatter[field]}" → "${converted}"`);
        }
      }
    }

    if (hasChanges) {
      const updatedContent = updateFrontmatter(content, updates);
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
      console.log(`✅ Updated: ${path.basename(filePath)}\n`);
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${path.basename(filePath)}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err.message);
    return false;
  }
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir) {
  let files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files = files.concat(findMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }

  return files;
}

/**
 * Main function
 */
function main() {
  console.log('🔧 Social Archiver - YAML Date Format Fixer\n');
  console.log(`📂 Scanning: ${ARCHIVE_PATH}\n`);

  if (!fs.existsSync(ARCHIVE_PATH)) {
    console.error(`❌ Archive path not found: ${ARCHIVE_PATH}`);
    process.exit(1);
  }

  const files = findMarkdownFiles(ARCHIVE_PATH);
  console.log(`📄 Found ${files.length} markdown files\n`);
  console.log('---\n');

  let processedCount = 0;
  let updatedCount = 0;

  for (const file of files) {
    processedCount++;
    if (processFile(file)) {
      updatedCount++;
    }
  }

  console.log('\n---\n');
  console.log(`✨ Done!`);
  console.log(`   Processed: ${processedCount} files`);
  console.log(`   Updated: ${updatedCount} files`);
}

main();
