# Deployment Guide for Social Archiver Share Web

## Overview

This guide explains how to deploy the Social Archiver Share Web application, including both the Worker API and SvelteKit frontend.

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- Wrangler CLI (installed automatically via npx)
- Cloudflare account with Pages configured
- Git repository with remote configured

## Deployment Scripts

### Quick Deployment

```bash
# Deploy only changed components (recommended)
npm run build:deploy

# or
npm run deploy
```

### Deployment Options

| Command | Description |
|---------|-------------|
| `npm run build:deploy` | Smart deploy - only deploys changed components |
| `npm run deploy` | Alias for build:deploy |
| `npm run deploy:force` | Force deploy all components regardless of changes |
| `npm run deploy:test` | Deploy and run tests afterward |
| `npm run deploy:worker` | Deploy only Worker API |
| `npm run deploy:pages` | Deploy only SvelteKit app |
| `npm run deploy:quick` | Quick deploy without change detection |
| `npm run deploy:sh` | Use bash script (Unix/Mac only) |

## How It Works

### Change Detection

The deployment script automatically detects changes in:
- Worker API code (`../worker/` directory)
- SvelteKit source (`src/` directory)
- Configuration files (`package.json`, `svelte.config.js`)

Only changed components are built and deployed, saving time and resources.

### Deployment Process

1. **Pre-deployment Checks**
   - Checks for uncommitted changes
   - Warns if working directory is dirty
   - Allows override with user confirmation

2. **Worker API Deployment** (if changed)
   - Builds TypeScript code
   - Minifies for production
   - Deploys to Cloudflare Workers
   - Updates KV bindings if configured

3. **SvelteKit Deployment** (if changed)
   - Runs Vite build process
   - Generates static assets
   - Optimizes with compression (gzip/brotli)
   - Deploys to Cloudflare Pages

4. **Post-deployment**
   - Shows deployment summary
   - Displays production URLs
   - Optionally runs tests

## Environment Configuration

### Cloudflare Settings

Ensure these are configured in your Cloudflare account:

1. **Pages Project**: `obsidian-social-archiver`
2. **Custom Domain**: `social-archive.junlim.org` (optional)
3. **Environment Variables**: Set in Pages settings

### Local Configuration

1. **wrangler.toml** - Worker configuration
2. **svelte.config.js** - SvelteKit adapter configuration
3. **.env** files - Local environment variables

## Manual Deployment

If automated scripts fail, you can deploy manually:

### Deploy SvelteKit Only

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy .svelte-kit/cloudflare \
  --project-name=obsidian-social-archiver \
  --commit-dirty=true
```

### Deploy Worker Only

```bash
# Navigate to worker directory
cd ../worker

# Build and deploy
npm run build
npx wrangler deploy --minify
```

## Troubleshooting

### Common Issues

1. **"Project not found" error**
   - Ensure Cloudflare Pages project exists
   - Check project name matches configuration

2. **Build failures**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Clear build cache: `rm -rf .svelte-kit`

3. **Permission denied (Unix/Mac)**
   - Make script executable: `chmod +x deploy.sh`
   - Use Node.js version: `npm run deploy`

4. **Windows compatibility**
   - Use Node.js scripts: `npm run deploy`
   - Avoid bash-specific commands

### Debug Mode

For detailed output during deployment:

```bash
# Set debug environment variable
DEBUG=* npm run deploy
```

## Rollback

To rollback to a previous deployment:

1. Go to Cloudflare Pages dashboard
2. Select the project
3. Navigate to "Deployments"
4. Choose a previous successful deployment
5. Click "Rollback to this deployment"

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd share-web && npm ci
      - run: cd share-web && npm run deploy:force
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Performance Monitoring

After deployment, monitor:

1. **Cloudflare Analytics** - Traffic and performance
2. **Worker Metrics** - API performance
3. **Pages Functions** - SSR performance
4. **Web Vitals** - User experience metrics

## Security Notes

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Enable Cloudflare security features (WAF, DDoS protection)
- Regular dependency updates: `npm audit fix`

## Support

For deployment issues:
1. Check deployment logs in Cloudflare dashboard
2. Review wrangler logs: `~/.wrangler/logs/`
3. Open an issue on GitHub with error details