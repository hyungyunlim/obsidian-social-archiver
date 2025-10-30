# Cloudflare Pages Deployment Checklist

## 🚨 Troubleshooting 522 Error

The 522 error indicates Cloudflare cannot connect to your origin server. For Cloudflare Pages, this usually means the build hasn't completed or failed.

## ✅ Cloudflare Dashboard Settings

### 1. Build Configuration
- **Framework preset**: SvelteKit
- **Build command**: `npm run build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Root directory (Path)**: `share-web`
- **Node version**: 20

### 2. Environment Variables
Add these in Settings → Environment Variables:
```
VITE_API_URL = https://social-archiver-api.junlim.org
```

### 3. Custom Domain
- Domain: `social-archive.junlim.org`
- SSL: Full (strict)
- Status: Should show "Active"

## 🔍 Common Issues & Solutions

### Issue: 522 Connection Timed Out
**Solutions:**
1. Check build logs in Cloudflare Pages dashboard
2. Verify the build output directory is correct
3. Ensure all dependencies are installed

### Issue: Build Failing
**Check:**
```bash
cd share-web
npm ci
npm run build
```

### Issue: Routes Not Working
- The `_redirects` file should be in `static/` directory
- SPA mode requires `/*  /index.html  200` redirect

## 📝 Manual Deployment (Alternative)

If automatic deployment fails, try manual deployment:

```bash
# From project root
cd share-web

# Install dependencies
npm ci

# Build the project
npm run build

# Deploy using Wrangler CLI
npx wrangler pages deploy .svelte-kit/cloudflare \
  --project-name=social-archiver-share \
  --branch=main
```

## 🔗 Important URLs

- **Cloudflare Pages Dashboard**: https://dash.cloudflare.com/?to=/:account/pages/view/social-archiver-share
- **Build Logs**: Check "Deployments" tab in dashboard
- **Custom Domain**: https://social-archive.junlim.org
- **Default URL**: https://social-archiver-share.pages.dev

## 🎯 Verification Steps

Once deployed successfully:

1. **Check main domain**:
   ```bash
   curl -I https://social-archive.junlim.org
   # Should return 200 or 302 (redirect)
   ```

2. **Check API connectivity**:
   ```bash
   curl https://social-archive.junlim.org/share/test
   # Should return 404 with proper HTML (user not found)
   ```

3. **Check security headers**:
   ```bash
   curl -I https://social-archive.junlim.org | grep -E "X-Frame|Content-Security"
   ```

## 📊 Expected Build Output

The build should create:
```
share-web/
└── .svelte-kit/
    └── cloudflare/
        ├── _app/
        ├── _worker.js
        └── index.html
```

## 🚀 GitHub Actions Deployment

Ensure these secrets are set in GitHub repository:
- `CLOUDFLARE_API_TOKEN` - Create at https://dash.cloudflare.com/profile/api-tokens
- `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare dashboard

Token permissions needed:
- Cloudflare Pages:Edit
- Account:Read