# ⚠️ CRITICAL: Cloudflare Pages Dashboard Settings

## 🔧 Build Configuration (MUST UPDATE!)

Go to your Cloudflare Pages project settings and update:

### Build settings:
- **Framework preset**: `SvelteKit` (or None)
- **Build command**: `npm run build`
- **Build output directory**: `.svelte-kit/output/client` ← ⚠️ THIS IS THE FIX!
- **Root directory (Advanced)**: `share-web`
- **Node version**: `20`

### Previous incorrect setting:
- ❌ Build output directory: `share-web/build`
- ❌ Build output directory: `build`
- ❌ Build output directory: `.svelte-kit/cloudflare`

### Correct setting:
- ✅ Build output directory: `.svelte-kit/output/client`

## 🌐 Custom Domain
- Domain: `social-archive.junlim.org`
- SSL: Full (strict)

## 📝 Environment Variables
```
VITE_API_URL = https://social-archiver-api.junlim.org
```

## 🚀 After Updating Settings

1. Go to **Deployments** tab
2. Click **Retry deployment** on the latest failed deployment
3. Or trigger a new deployment by pushing a commit

## ✅ Verification

Once deployed successfully, test:

```bash
# Should return 200 OK
curl -I https://social-archive.junlim.org

# Check a user timeline (should return 404 with HTML if user doesn't exist)
curl https://social-archive.junlim.org/share/test

# Check API connectivity
curl https://social-archive.junlim.org/share/hyungyunlim
```

## 📁 Build Output Structure

The SvelteKit adapter-cloudflare generates:
```
.svelte-kit/
└── output/
    ├── client/       ← This is what Cloudflare Pages serves
    │   ├── _app/
    │   └── index.html
    └── server/       ← Server-side components (handled by Workers)
```

## 🔍 Troubleshooting

If still getting errors after changing the build output directory:

1. Check build logs for any npm install failures
2. Ensure Node.js version is set to 20
3. Clear build cache in Cloudflare Pages settings
4. Try manual deployment:
   ```bash
   cd share-web
   npm ci
   npm run build
   npx wrangler pages deploy .svelte-kit/output/client --project-name=social-archiver-share
   ```