#!/bin/bash

# Deploy script for Social Archiver Share Web
# Deploys only changed components (Worker API, SvelteKit)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="obsidian-social-archiver"
WORKER_PATH="../worker"
SHARE_WEB_PATH="."

echo -e "${GREEN}🚀 Starting Social Archiver deployment...${NC}"

# Function to check if files have changed
has_changes() {
    local path=$1
    local changes=$(git diff HEAD --name-only -- "$path" 2>/dev/null | wc -l)
    local staged=$(git diff --cached --name-only -- "$path" 2>/dev/null | wc -l)
    local untracked=$(git ls-files --others --exclude-standard -- "$path" 2>/dev/null | wc -l)

    if [ $changes -gt 0 ] || [ $staged -gt 0 ] || [ $untracked -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

# Function to get last commit hash for a path
get_last_commit() {
    local path=$1
    git log -1 --pretty=format:"%h" -- "$path" 2>/dev/null || echo "none"
}

# Check for uncommitted changes warning
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled${NC}"
        exit 1
    fi
fi

# Deploy Worker API if changed
WORKER_CHANGED=false
if [ -d "$WORKER_PATH" ]; then
    LAST_WORKER_COMMIT=$(get_last_commit "$WORKER_PATH")

    if has_changes "$WORKER_PATH" || [ "$1" = "--force" ]; then
        echo -e "${YELLOW}📦 Worker API has changes (last commit: $LAST_WORKER_COMMIT)${NC}"
        echo "Building and deploying Worker API..."

        cd "$WORKER_PATH"

        # Build worker
        if [ -f "package.json" ]; then
            npm run build 2>/dev/null || npm install && npm run build
        fi

        # Deploy to Cloudflare Workers
        if [ -f "wrangler.toml" ]; then
            npx wrangler deploy --minify
            echo -e "${GREEN}✅ Worker API deployed successfully${NC}"
            WORKER_CHANGED=true
        else
            echo -e "${YELLOW}⚠️  No wrangler.toml found, skipping Worker deployment${NC}"
        fi

        cd - > /dev/null
    else
        echo -e "${GREEN}✓ Worker API unchanged (last commit: $LAST_WORKER_COMMIT)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Worker directory not found, skipping Worker deployment${NC}"
fi

# Deploy SvelteKit app
SVELTEKIT_CHANGED=false
LAST_SVELTEKIT_COMMIT=$(get_last_commit "$SHARE_WEB_PATH/src")

if has_changes "$SHARE_WEB_PATH/src" || has_changes "$SHARE_WEB_PATH/package.json" || has_changes "$SHARE_WEB_PATH/svelte.config.js" || [ "$1" = "--force" ]; then
    echo -e "${YELLOW}📦 SvelteKit app has changes (last commit: $LAST_SVELTEKIT_COMMIT)${NC}"
    echo "Building SvelteKit app..."

    # Install dependencies if needed
    if [ ! -d "node_modules" ] || [ "$1" = "--fresh" ]; then
        echo "Installing dependencies..."
        npm install
    fi

    # Build the app
    npm run build

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build successful${NC}"

        # Deploy to Cloudflare Pages
        echo "Deploying to Cloudflare Pages..."
        # Ensure we're in the share-web directory
        cd "$SHARE_WEB_PATH"
        npx wrangler pages deploy .svelte-kit/cloudflare \
            --project-name="$PROJECT_NAME" \
            --commit-dirty=true \
            --commit-message="Deploy: $(date +'%Y-%m-%d %H:%M:%S')"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ SvelteKit app deployed successfully${NC}"
            SVELTEKIT_CHANGED=true
        else
            echo -e "${RED}❌ Deployment failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ SvelteKit app unchanged (last commit: $LAST_SVELTEKIT_COMMIT)${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}🎉 Deployment Summary:${NC}"
if [ "$WORKER_CHANGED" = true ]; then
    echo -e "  • Worker API: ${GREEN}Deployed${NC}"
else
    echo -e "  • Worker API: ${NC}No changes${NC}"
fi

if [ "$SVELTEKIT_CHANGED" = true ]; then
    echo -e "  • SvelteKit: ${GREEN}Deployed${NC}"
else
    echo -e "  • SvelteKit: ${NC}No changes${NC}"
fi

# Get deployment URLs
echo ""
echo -e "${GREEN}📍 Deployment URLs:${NC}"
echo "  • Production: https://social-archive.junlim.org"
echo "  • Preview: Check Cloudflare Pages dashboard"

# Optional: Run tests after deployment
if [ "$2" = "--test" ]; then
    echo ""
    echo -e "${YELLOW}🧪 Running post-deployment tests...${NC}"
    npm run test:e2e 2>/dev/null || echo -e "${YELLOW}No e2e tests configured${NC}"
fi

echo ""
echo -e "${GREEN}✨ Deployment complete!${NC}"