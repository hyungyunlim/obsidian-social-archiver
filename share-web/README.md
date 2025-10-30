# Social Archiver Share Web

SvelteKit application for sharing archived social media posts.

## 🚀 Features

- View user timelines with archived posts
- Individual post pages with full content
- SEO optimized with Open Graph and Twitter Cards
- Responsive design for mobile and desktop
- Markdown rendering with syntax highlighting
- Dark mode support

## 📦 Tech Stack

- **Framework**: SvelteKit with Svelte 5 (Runes API)
- **Styling**: Tailwind CSS
- **Deployment**: Cloudflare Pages
- **API**: Cloudflare Workers

## 🛠️ Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev

# Open http://localhost:5173
```

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run check     # Run type checking
npm run lint      # Run linting
npm run format    # Format code
```

## 🌐 Deployment

The application is automatically deployed to Cloudflare Pages when changes are pushed to the `main` branch.

### Environment Variables

Set these in the Cloudflare Pages dashboard:

- `VITE_API_URL`: API endpoint (default: `https://social-archiver-api.junlim.org`)

### Manual Deployment

```bash
# Build the application
npm run build

# Deploy using Wrangler
npx wrangler pages deploy build
```

## 📁 Project Structure

```
share-web/
├── src/
│   ├── lib/
│   │   ├── api/          # API client
│   │   ├── components/   # Reusable components
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   ├── routes/
│   │   └── share/
│   │       ├── [username]/        # User timeline
│   │       └── [username]/[postId]/ # Individual post
│   └── app.html          # HTML template
├── static/               # Static assets
├── package.json
├── svelte.config.js     # SvelteKit config
├── tailwind.config.js   # Tailwind config
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── wrangler.toml        # Cloudflare Pages config
```

## 🔗 URLs

- **Production**: https://social-archiver-share.pages.dev
- **Custom Domain**: https://social-archive.junlim.org
- **API**: https://social-archiver-api.junlim.org

## 📊 Routes

- `/share/{username}` - User's timeline of shared posts
- `/share/{username}/{postId}` - Individual post page

## 🔒 Security

- Content Security Policy (CSP) headers
- XSS protection via DOMPurify
- HTTPS-only deployment
- Frame-ancestors prevention

## 🧪 Testing

```bash
# Run tests (when implemented)
npm run test

# Run E2E tests with Playwright (when implemented)
npm run test:e2e
```

## 📄 License

Part of the Social Archiver project.