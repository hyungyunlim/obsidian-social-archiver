# Obsidian Social Archiver

Save what matters. Archive social media posts from Facebook, LinkedIn, Instagram, TikTok, X.com, and Threads directly into your Obsidian vault.

## Features

- **Multi-Platform Support**: Archive posts from major social media platforms
- **Rich Media Preservation**: Save images, videos, and other media attachments
- **AI-Powered Analysis**: Get summaries, fact-checking, and sentiment analysis (Pro)
- **Markdown Conversion**: Posts are saved as clean, readable Markdown files
- **Privacy-First**: Your data stays in your vault
- **Mobile Support**: Works on Obsidian Mobile (iOS/Android)
- **Share Links**: Generate shareable links for archived posts (Pro)

## Supported Platforms

- Facebook (Posts, Photos, Videos)
- LinkedIn (Posts, Articles)
- Instagram (Posts, Reels, Stories)
- TikTok (Videos)
- X.com / Twitter (Tweets, Threads)
- Threads (Posts)

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to Community Plugins and enable them
3. Click Browse and search for "Social Archiver"
4. Click Install, then Enable

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/hyungyunlim/obsidian-social-archiver/releases)
2. Extract the files into your vault's `.obsidian/plugins/social-archiver/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Usage

### Quick Archive

1. Copy the URL of any supported social media post
2. Open the command palette (Cmd/Ctrl + P)
3. Run "Social Archiver: Archive from URL"
4. Paste the URL and click Archive

### Mobile Share Extension

1. Open any social media app
2. Find the post you want to archive
3. Tap Share → Social Archiver
4. The post will be saved to your vault

## Pricing

### Free Plan
- 10 archives per month
- Basic markdown conversion
- 30-day share links

### Pro Plan ($19.99/month)
- 500 archives per month
- AI-powered analysis
- Permanent share links
- Priority support
- Custom domain for shares

## Privacy & Security

- All processing happens on secure servers
- No data is stored outside your vault
- GDPR compliant
- End-to-end encryption for Pro users

## Development

This plugin uses:
- TypeScript 5.0+ with strict mode
- Svelte 5 with Runes API
- Vite for bundling
- Single Responsibility Principle architecture

### Building from Source

```bash
# Install dependencies
npm install

# Development build with hot reload
npm run dev

# Production build
npm run build

# Run tests
npm test
```

### Local Development & Testing

#### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/hyungyunlim/obsidian-social-archiver.git
   cd obsidian-social-archiver
   npm install
   ```

2. **Build and deploy to test vault**
   ```bash
   # Build once and copy to test vault
   npm run build:deploy

   # Or build and watch for changes
   npm run dev
   ```

3. **Enable in Obsidian**
   - Open your test vault in Obsidian
   - Settings → Community Plugins
   - Find "Social Archiver" and toggle it on
   - Click "Reload" after code changes

#### Custom Test Vault Location

By default, the plugin deploys to:
```
/Users/[username]/Library/Mobile Documents/iCloud~md~obsidian/Documents/test/.obsidian
```

To use a different vault, set the environment variable:
```bash
export SOCIAL_ARCHIVER_TEST_VAULT="/path/to/your/vault/.obsidian"
npm run build:deploy
```

#### Testing Features

**1. Basic UI**
- ✅ Ribbon icon appears in left sidebar
- ✅ Click opens Archive Modal
- ✅ Modal has URL input field
- ✅ Disclaimer is displayed
- ✅ Archive button shows "Coming Soon" message

**2. Commands**
- ✅ Cmd/Ctrl + P → "Archive social media post"
- ✅ Cmd/Ctrl + P → "Archive from clipboard URL"
- ✅ Clipboard command auto-fills URL if valid

**3. Settings**
- ✅ Settings → Social Archiver tab
- ✅ API URL configuration
- ✅ Archive/Media folder paths
- ✅ License key input
- ✅ Feature toggles (Download media, AI enhancement)

**4. URL Validation**
- ✅ Validates URLs from supported platforms
- ✅ Rejects invalid or unsupported URLs
- ✅ Shows appropriate error messages

**5. Protocol Handler** (Mobile Share)
- ✅ `obsidian://social-archive?url=...` opens modal
- ✅ URL parameter is pre-filled

#### Development Workflow

```bash
# Make code changes in src/

# Option 1: Build and deploy manually
npm run build:deploy

# Option 2: Watch mode (auto-rebuild on save)
npm run dev
# Then in another terminal:
node scripts/deploy-to-vault.mjs

# Reload plugin in Obsidian:
# Settings → Community Plugins → Social Archiver → Reload icon
```

#### Testing Backend (Cloudflare Workers)

```bash
cd workers

# Run tests
npm test

# Local development server
npm run dev

# Deploy to Cloudflare
npm run deploy
```

#### Project Structure

```
obsidian-social-archiver/
├── src/                      # Plugin source code
│   ├── main.ts              # Main plugin entry
│   ├── settings/            # Settings UI
│   ├── services/            # Business logic
│   ├── components/          # Svelte components
│   └── types/               # TypeScript types
├── workers/                  # Cloudflare Workers API
│   ├── src/
│   │   ├── handlers/        # API endpoints
│   │   ├── services/        # Backend services
│   │   └── types/          # Backend types
│   └── tests/              # Worker tests
├── scripts/
│   └── deploy-to-vault.mjs  # Auto-deploy script
└── tests/                   # Plugin tests
```

#### Debugging Tips

**Plugin not loading?**
- Check Developer Console: View → Toggle Developer Tools
- Look for errors in Console tab
- Verify files exist in `.obsidian/plugins/obsidian-social-archiver/`

**Changes not appearing?**
- Make sure you ran `npm run build:deploy`
- Reload the plugin: Settings → Community Plugins → Reload icon
- If still not working, restart Obsidian

**Build errors?**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run typecheck`
- Verify all imports are correct

**Testing mobile features?**
- Use Obsidian Mobile app with iCloud sync
- Plugin will auto-sync to mobile after deployment
- Enable plugin in mobile Settings

#### Running Tests

```bash
# Plugin tests (Vitest)
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage

# Workers tests
cd workers && npm test

# Specific test file
npm test ShareManager
```

## Support

- [Documentation](https://github.com/hyungyunlim/obsidian-social-archiver/wiki)
- [Report Issues](https://github.com/hyungyunlim/obsidian-social-archiver/issues)
- [Discord Community](https://discord.gg/obsidian-social-archiver)

## License

MIT © 2024 Hyungyun Lim

## Disclaimer

⚠️ **Important**: Only archive content you have permission to save. Respect copyright and privacy laws in your jurisdiction. This tool is for personal archiving only.