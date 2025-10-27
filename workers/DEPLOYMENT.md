# 🚀 Social Archiver Workers - Deployment Guide

## 📋 Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)

## 🔑 Required API Keys

### 1. BrightData API Key
- **Purpose**: Social media scraping
- **Get it**: https://brightdata.com/
- **Your key**: `149b0458041b2d254fe487ea670d4a48fda70df2ecba8438ac47bc93e9016a69`

### 2. Gumroad Product ID
- **Purpose**: License validation
- **Type**: Product ID (NOT API key)
- **Your ID**: `ejYMaTawFx4ZjF5kChizgw==`
- **Note**: This is for "Social Archiver Pro" product

### 3. Perplexity API Key (Optional)
- **Purpose**: AI content analysis and fact-checking
- **Get it**: https://www.perplexity.ai/settings/api
- **Required for**: Pro users with AI features enabled

### 4. HMAC Secret
- **Purpose**: Secure share link generation
- **Type**: Random string (32+ characters recommended)
- **Generate**: `openssl rand -hex 32`

### 5. Gumroad Webhook Secret (Optional)
- **Purpose**: Verify webhook authenticity from Gumroad
- **Get it**: From Gumroad product settings → Webhooks

## 🏗️ Setup Instructions

### Step 1: Install Dependencies

```bash
cd workers
npm install
```

### Step 2: Login to Cloudflare

```bash
npx wrangler login
```

This will open a browser for authorization.

### Step 3: Verify KV Namespaces

The KV namespaces are already configured in `wrangler.toml`. Verify they exist:

```bash
npx wrangler kv:namespace list
```

You should see:
- `ARCHIVE_CACHE` (id: 1e9245a691714dfeaddf00f2d7f2e654)
- `LICENSE_KEYS` (id: 75c0239b9f0849488c5a4c2caf7c38a2)
- `SHARE_LINKS` (id: bbb1768a9f6c45fc91a98eda7a99f2ea)

If they don't exist, create them:

```bash
npx wrangler kv:namespace create "ARCHIVE_CACHE"
npx wrangler kv:namespace create "LICENSE_KEYS"
npx wrangler kv:namespace create "SHARE_LINKS"

# For preview (development)
npx wrangler kv:namespace create "ARCHIVE_CACHE" --preview
npx wrangler kv:namespace create "LICENSE_KEYS" --preview
npx wrangler kv:namespace create "SHARE_LINKS" --preview
```

### Step 4: Set Production Secrets

**IMPORTANT**: Use `wrangler secret put` for sensitive values. These are encrypted and never stored in `wrangler.toml`.

```bash
# Set BrightData API Key
npx wrangler secret put BRIGHTDATA_API_KEY
# Paste: 149b0458041b2d254fe487ea670d4a48fda70df2ecba8438ac47bc93e9016a69

# Set Gumroad Product ID
npx wrangler secret put GUMROAD_PRODUCT_ID
# Paste: ejYMaTawFx4ZjF5kChizgw==

# Set HMAC Secret (generate one first)
npx wrangler secret put HMAC_SECRET
# Paste: <your-generated-secret>

# Optional: Set Perplexity API Key (for AI features)
npx wrangler secret put PERPLEXITY_API_KEY
# Paste: <your-perplexity-key>

# Optional: Set Gumroad Webhook Secret
npx wrangler secret put GUMROAD_WEBHOOK_SECRET
# Paste: <your-webhook-secret>
```

### Step 5: Local Development Setup

Create `.dev.vars` file (already created):

```bash
# The file is already created with your keys
# Make sure it's in .gitignore (it is)
cat .dev.vars
```

### Step 6: Test Locally

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

Test the health endpoint:

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### Step 7: Deploy to Production

```bash
npm run deploy
```

Or directly:

```bash
npx wrangler deploy
```

After deployment, you'll see:

```
✨ Deployment complete!
🌍 https://social-archiver-api.junlim.org
🌍 https://social-archiver-api.<your-subdomain>.workers.dev
```

### Step 8: Verify Production Deployment

```bash
curl https://social-archiver-api.junlim.org/health
```

## 🧪 Testing the API

### Test License Validation

```bash
curl -X POST https://social-archiver-api.junlim.org/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey": "YOUR_TEST_LICENSE_KEY"}'
```

### Test Archive Request

```bash
curl -X POST https://social-archiver-api.junlim.org/api/archive \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.facebook.com/zuck/posts/10114953989867471",
    "options": {
      "enableAI": false,
      "downloadMedia": true
    }
  }'
```

## 📊 Monitoring

### View Logs

```bash
npm run tail
```

Or:

```bash
npx wrangler tail
```

### Check KV Storage

```bash
# List all keys in a namespace
npx wrangler kv:key list --binding=LICENSE_KEYS

# Get a specific value
npx wrangler kv:key get "license:YOUR_LICENSE_KEY" --binding=LICENSE_KEYS
```

### Analytics

View analytics in Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select `social-archiver-api`
3. Click "Metrics" tab

## 🔧 Troubleshooting

### Error: "BRIGHTDATA_API_KEY is required"

**Solution**: Make sure the secret is set:

```bash
npx wrangler secret put BRIGHTDATA_API_KEY
```

### Error: "KV namespace not found"

**Solution**: Update the KV namespace IDs in `wrangler.toml` to match your account:

```bash
npx wrangler kv:namespace list
```

Then update `wrangler.toml` with the correct IDs.

### Local Development CORS Issues

**Solution**: The API is already configured to accept requests from:
- `app://obsidian.md`
- `obsidian://`
- `capacitor://localhost`
- `http://localhost`
- `https://localhost`

### Gumroad Validation Failing

**Check**:
1. Product ID is correct: `ejYMaTawFx4ZjF5kChizgw==`
2. License key format is correct
3. Check Gumroad API status: https://status.gumroad.com/

**Test manually**:

```bash
curl -X POST https://api.gumroad.com/v2/licenses/verify \
  -d "product_id=ejYMaTawFx4ZjF5kChizgw==" \
  -d "license_key=YOUR_LICENSE_KEY"
```

## 🔄 Update Workflow

### Update Code

```bash
# 1. Make changes to src/
# 2. Test locally
npm run dev

# 3. Deploy
npm run deploy
```

### Update Secrets

```bash
# Update a secret
npx wrangler secret put SECRET_NAME

# Delete a secret
npx wrangler secret delete SECRET_NAME

# List all secrets
npx wrangler secret list
```

## 🌐 Custom Domain

Your worker is already configured for:
- **Custom Domain**: `social-archiver-api.junlim.org`
- **Worker Domain**: `social-archiver-api.<your-subdomain>.workers.dev`

To use a different custom domain:

1. Go to Cloudflare Dashboard
2. Select your zone (domain)
3. Workers Routes → Add route
4. Pattern: `social-archiver-api.your-domain.com/*`
5. Worker: `social-archiver-api`

## 📝 Environment Variables Reference

| Variable | Type | Required | Purpose |
|----------|------|----------|---------|
| `BRIGHTDATA_API_KEY` | Secret | Yes | Social media scraping |
| `GUMROAD_PRODUCT_ID` | Secret | Yes | License validation |
| `PERPLEXITY_API_KEY` | Secret | No | AI content analysis |
| `HMAC_SECRET` | Secret | Yes | Share link security |
| `GUMROAD_WEBHOOK_SECRET` | Secret | No | Webhook verification |
| `ENVIRONMENT` | Variable | Yes | Set in wrangler.toml |

## 🔐 Security Best Practices

1. **Never commit secrets** to git
2. **Use `wrangler secret put`** for sensitive values
3. **Rotate secrets** periodically
4. **Monitor API usage** for unusual patterns
5. **Set rate limits** in production
6. **Enable WAF** in Cloudflare dashboard

## 🎯 Next Steps

1. ✅ Deploy to production
2. ✅ Test all endpoints
3. ✅ Set up monitoring
4. 📱 Update Obsidian plugin settings with your Worker URL
5. 🧪 Test end-to-end archiving flow
6. 📊 Monitor usage and costs

## 🆘 Support

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Issues**: Report bugs in GitHub repository
