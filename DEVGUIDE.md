# Social Archiver Development Guide

## 🚀 Quick Start

### Full Development Environment (Recommended)
```bash
# Start everything for local development
npm run dev:all

# This will:
# 1. Switch plugin to dev mode (http://localhost:8787)
# 2. Start Workers API on :8787 (development environment)
# 3. Start Share Web on :5173
# 4. Watch for changes
```

### Individual Environment Commands

#### 🔄 Environment Switching

**Plugin Settings:**
```bash
# Switch to local development
npm run env:dev

# Switch to production
npm run env:prod

# Switch to staging (if available)
npm run env:staging
```

**Share Web Settings:**
```bash
cd share-web
npm run env:dev  # Local API (localhost:8787)
npm run env:prod # Production API
```

**All Projects at Once:**
```bash
# Switch everything to dev
npm run env:dev-all

# Switch everything to prod
npm run env:prod-all
```

#### 🏗️ Development Workflows

**Plugin Development:**
```bash
# Build and deploy to vault once
npm run dev:deploy

# Build, deploy, and watch for changes
npm run dev:full

# Just watch and rebuild (no deploy)
npm run dev
```

**Share Web Development:**
```bash
cd share-web
npm run dev        # Use current .env settings
npm run dev:local  # Force local API
npm run dev:prod   # Force production API
```

**Workers API Development:**
```bash
cd workers
npm run dev         # Basic local development
npm run dev:local   # Local with development environment
npm run dev:remote  # Connect to remote development environment
npm run dev:staging # Connect to staging environment

# From root directory
npm run worker:dev    # Start local worker
npm run worker:deploy # Deploy to production
npm run worker:logs   # View production logs
```

## 📦 Production Deployment

### 🚀 Full Deployment Options

```bash
# Interactive deployment (asks for confirmation)
npm run deploy:all              # Deploy and stay in prod mode
npm run deploy:dev              # Deploy and return to dev mode

# Automated deployment (no confirmation)
npm run deploy:quick            # Deploy and return to dev (recommended)
npm run deploy:prod-only        # Deploy and stay in prod

# Manual deployment steps
npm run build:prod              # Plugin only
npm run worker:prod             # Workers API only
cd share-web && npm run build:deploy  # Share Web only
```

### 📋 Deployment Commands Explained

| Command | Description | Confirms? | Returns to Dev? |
|---------|-------------|-----------|-----------------|
| `npm run deploy:all` | Full deployment | Yes | No |
| `npm run deploy:dev` | Deploy & return to dev | Yes | Yes |
| `npm run deploy:quick` | Quick deploy for devs | No | Yes |
| `npm run deploy:prod-only` | CI/CD deployment | No | No |

## 🔍 Environment Details

### Development Mode
- **Plugin API**: `http://localhost:8787`
- **Share Web**: `http://localhost:5173`
- **Debug Mode**: ON
- **Sharing**: Enabled

### Production Mode
- **Plugin API**: `https://social-archiver-api.junlim.org`
- **Share Web**: `https://social-archive.junlim.org`
- **Debug Mode**: OFF
- **Sharing**: Enabled

## 📝 Configuration Files

### Plugin Configuration
- **Location**: `/Users/hyungyunlim/vaults/test/.obsidian/plugins/obsidian-social-archiver/data.json`
- **Key Fields**:
  - `workerUrl`: API endpoint
  - `debugMode`: Enable/disable debug logging
  - `enableSharing`: Enable/disable share features

### Share Web Configuration
- **Location**: `share-web/.env`
- **Key Fields**:
  - `VITE_API_URL`: Worker API endpoint

## 🛠️ Troubleshooting

### After Switching Environments

1. **Plugin**: Reload in Obsidian
   - Settings → Community Plugins → Social Archiver → Reload

2. **Share Web**: Restart dev server
   - Stop (Ctrl+C) and restart `npm run dev`

### Common Issues

**CORS Errors:**
- Make sure Workers API is running (`cd workers && npm run dev`)
- Check that the correct environment is set

**404 Errors:**
- Local KV store might be empty
- Create test data by sharing a post from Obsidian

**Port Conflicts:**
- Workers: Default port 8787
- Share Web: Default port 5173
- Kill existing processes if needed

## 📚 Scripts Reference

### Root Package Scripts
| Command | Description |
|---------|-------------|
| `npm run dev:all` | Start full dev environment |
| `npm run dev:full` | Plugin dev with auto-deploy |
| `npm run env:dev` | Switch plugin to dev mode |
| `npm run env:prod` | Switch plugin to prod mode |
| `npm run env:dev-all` | Switch all to dev mode |
| `npm run env:prod-all` | Switch all to prod mode |
| `npm run build:prod` | Build plugin for production |
| `npm run worker:dev` | Start Worker in dev mode |
| `npm run worker:prod` | Deploy Worker to production |
| `npm run worker:logs` | View Worker logs |

### Share Web Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run dev:local` | Dev with local API |
| `npm run dev:prod` | Dev with prod API |
| `npm run env:dev` | Use local API |
| `npm run env:prod` | Use production API |
| `npm run build:deploy` | Build and deploy to Cloudflare |

### Worker Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Basic local development |
| `npm run dev:local` | Local with dev environment |
| `npm run dev:remote` | Remote dev environment |
| `npm run dev:staging` | Staging environment |
| `npm run deploy` | Deploy to production |
| `npm run deploy:dev` | Deploy to development |
| `npm run deploy:staging` | Deploy to staging |
| `npm run tail` | View live logs |
| `npm run logs` | View formatted logs |

## 🔗 URLs

### Local Development
- Plugin API: http://localhost:8787
- Share Web: http://localhost:5173
- User Timeline: http://localhost:5173/[username]
- Single Post: http://localhost:5173/[username]/[postId]

### Production
- Plugin API: https://social-archiver-api.junlim.org
- Share Web: https://social-archive.junlim.org