# Development Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Obsidian app installed
- Git

### Initial Setup

```bash
# Clone and install
git clone https://github.com/hyungyunlim/obsidian-social-archiver.git
cd obsidian-social-archiver
npm install

# Install Workers dependencies
cd workers
npm install
cd ..
```

## 🏗 Architecture

### Plugin Architecture (Frontend)

```
src/
├── main.ts                   # Plugin entry point
├── settings/
│   └── SettingTab.ts        # Settings UI
├── services/
│   ├── ShareManager.ts      # Share link management
│   ├── CreditManager.ts     # Credit tracking
│   └── ...                  # Other services
├── components/              # Svelte 5 components
│   └── archive/
│       └── ArchiveModal.svelte
└── types/
    ├── settings.ts          # Plugin settings
    └── license.ts           # License types
```

### Workers Architecture (Backend)

```
workers/src/
├── index.ts                 # Main worker entry
├── handlers/
│   ├── webhook.ts          # Gumroad webhooks
│   └── public-share.ts     # Public share pages
├── services/
│   ├── KVStorageAdapter.ts # KV/R2 storage
│   ├── PasswordManager.ts  # Password hashing
│   └── ShareService.ts     # Share logic
└── types/
    └── bindings.ts         # Worker bindings
```

## 🔧 Development Workflow

### 1. Local Plugin Development

```bash
# Terminal 1: Watch and rebuild on changes
npm run dev

# Terminal 2: Auto-deploy to test vault on each build
while true; do
  node scripts/deploy-to-vault.mjs
  sleep 5
done

# Or manually after each change:
npm run build:deploy
```

### 2. Testing in Obsidian

1. Open test vault in Obsidian
2. Settings → Community Plugins → Social Archiver
3. Toggle to enable
4. After code changes: Click reload icon ↻

**Developer Console**: `View → Toggle Developer Tools`

### 3. Workers Development

```bash
cd workers

# Local development server (with KV/R2 emulation)
npm run dev

# Test API locally
curl http://localhost:8787/api/health

# Deploy to Cloudflare
npm run deploy
```

## 🧪 Testing

### Plugin Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm test -- --watch

# Coverage report
npm run test:coverage

# Specific test file
npm test ShareManager

# UI mode (interactive)
npm run test:ui
```

### Workers Tests

```bash
cd workers

# Run all workers tests
npm run test:ci

# Specific test
npm test KVStorageAdapter
npm test PasswordManager
```

### Test Coverage

Current coverage:
- **ShareManager**: 40/40 tests ✅ (100%)
- **KVStorageAdapter**: 25/25 tests ✅ (100%)
- **PasswordManager**: 44/44 tests ✅ (100%)
- **Overall**: 112/131 tests ✅ (85%)

## 📝 Code Style

### TypeScript Guidelines

```typescript
// ✅ DO: Use strict types
interface ShareInfo {
  id: string;
  content: string;
  tier: 'free' | 'pro';
}

// ❌ DON'T: Use any
function processShare(data: any) { } // Bad

// ✅ DO: Single Responsibility Principle
class ShareManager {
  // Only handles share logic
}

// ✅ DO: Proper error handling
try {
  await service.doSomething();
} catch (error) {
  if (error instanceof ShareError) {
    new Notice(error.message);
  }
  console.error('[Social Archiver]', error);
}
```

### Svelte 5 Guidelines

```svelte
<script lang="ts">
  // ✅ DO: Use Runes API
  let count = $state(0);
  let doubled = $derived(count * 2);

  // ❌ DON'T: Use old reactive syntax
  let count = 0; // Bad
  $: doubled = count * 2; // Bad
</script>
```

### Naming Conventions

- **Files**: PascalCase for classes (`ShareManager.ts`)
- **Variables**: camelCase (`shareInfo`, `apiUrl`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_SETTINGS`)
- **Types/Interfaces**: PascalCase (`ShareInfo`, `LicenseStatus`)
- **Components**: PascalCase (`ArchiveModal.svelte`)

## 🐛 Debugging

### Plugin Debugging

**1. Enable Developer Tools**
```
View → Toggle Developer Tools → Console tab
```

**2. Add debug logs**
```typescript
console.log('[Social Archiver] Debug info:', data);
```

**3. Check plugin files**
```bash
ls -la "/Users/$(whoami)/Library/Mobile Documents/iCloud~md~obsidian/Documents/test/.obsidian/plugins/obsidian-social-archiver/"
```

### Workers Debugging

**1. Local testing**
```bash
cd workers
npm run dev
# Workers running at http://localhost:8787
```

**2. Tail logs from production**
```bash
wrangler tail
```

**3. Check KV data**
```bash
wrangler kv:key get --namespace-id=<id> "share:test123"
```

## 📦 Build & Deploy

### Plugin Build

```bash
# Development build (with source maps)
npm run dev

# Production build (minified)
npm run build

# Type check only (no build)
npm run typecheck

# Lint code
npm run lint
```

### Workers Deploy

```bash
cd workers

# Deploy to production
npm run deploy

# Deploy to specific environment
wrangler deploy --env staging
```

## 🔑 Environment Setup

### Required Secrets

**Plugin** (`.env` not needed for basic development)

**Workers** (Required for deployment)
```bash
# Set via Wrangler
wrangler secret put GUMROAD_API_KEY
wrangler secret put GUMROAD_WEBHOOK_SECRET
wrangler secret put BRIGHTDATA_API_KEY
wrangler secret put PERPLEXITY_API_KEY
```

### KV Namespaces

```bash
# Create KV namespaces (one-time setup)
wrangler kv:namespace create ARCHIVE_CACHE
wrangler kv:namespace create LICENSE_KEYS
wrangler kv:namespace create SHARE_LINKS

# Add IDs to wrangler.toml
```

### R2 Buckets

```bash
# Create R2 bucket (one-time setup)
wrangler r2 bucket create social-archiver-shares

# Add to wrangler.toml
```

## 🚢 Release Process

### 1. Update Version

```bash
# Updates manifest.json and versions.json
npm run version
```

### 2. Create Release

```bash
# Build production version
npm run build

# Create GitHub release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 3. Deploy Workers

```bash
cd workers
npm run deploy
```

## 🎯 Task Management

This project uses [Task Master AI](https://github.com/cyanheads/task-master-ai) for development task tracking.

### Common Commands

```bash
# View all tasks
task-master list

# Get next task
task-master next

# Show task details
task-master show <id>

# Mark task complete
task-master set-status --id=<id> --status=done

# Add new task
task-master add-task --prompt="description"

# Expand task into subtasks
task-master expand --id=<id>
```

### Current Progress

- ✅ Task 1-8: Core infrastructure (100%)
- ✅ Task 10: Share system (100%)
- ⏳ Task 9: AI Enhancement (0% - next priority)

## 🤝 Contributing

### Before Submitting PR

1. ✅ All tests pass: `npm test`
2. ✅ Type check passes: `npm run typecheck`
3. ✅ Lint passes: `npm run lint`
4. ✅ Build succeeds: `npm run build`
5. ✅ Tested in Obsidian: Manual verification
6. ✅ Updated README if needed

### PR Guidelines

- Clear description of changes
- Reference issue number if applicable
- Include screenshots for UI changes
- Update tests for new features
- Follow existing code style

## 📚 Resources

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Svelte 5 Docs](https://svelte-5-preview.vercel.app/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Task Master AI](https://github.com/cyanheads/task-master-ai)

## 🆘 Getting Help

- **Issues**: [GitHub Issues](https://github.com/hyungyunlim/obsidian-social-archiver/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hyungyunlim/obsidian-social-archiver/discussions)
- **Discord**: Coming soon

## 📄 License

MIT © 2024 Hyungyun Lim
