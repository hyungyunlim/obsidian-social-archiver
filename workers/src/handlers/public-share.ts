import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Env } from '@/types/bindings';
import { KVStorageAdapter } from '@/services/KVStorageAdapter';
import { PasswordManager, PasswordRateLimiter } from '@/services/PasswordManager';
import { marked } from 'marked';
import { Logger } from '@/utils/logger';

export const publicShareRouter = new Hono<Env>();

// Configure marked for safe HTML rendering
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false
});

/**
 * GET /share/:id - Public share page
 */
publicShareRouter.get('/:id', async (c) => {
  const shareId = c.req.param('id');
  const password = c.req.query('password');
  const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';

  try {
    // Initialize services
    const storage = new KVStorageAdapter(c.env.SHARE_LINKS, c.env.R2_BUCKET);
    const passwordManager = new PasswordManager();
    const rateLimiter = new PasswordRateLimiter(c.env.SHARE_LINKS);

    // Get share data
    const result = await storage.getShare(shareId);

    if (!result.success || !result.data) {
      return c.html(renderNotFoundPage(), 404);
    }

    const shareInfo = result.data;

    // Check if expired
    if (shareInfo.expiresAt && new Date() > shareInfo.expiresAt) {
      return c.html(renderExpiredPage(), 410);
    }

    // Check password protection
    if (shareInfo.password) {
      if (!password) {
        return c.html(renderPasswordPromptPage(shareId), 401);
      }

      // Check rate limit
      const limitCheck = await rateLimiter.checkLimit(clientIP);
      if (!limitCheck.allowed) {
        return c.html(renderRateLimitPage(), 429);
      }

      // Verify password
      const isValid = await passwordManager.verifyPassword(password, shareInfo.password);

      if (!isValid) {
        await rateLimiter.recordAttempt(clientIP);
        return c.html(renderPasswordPromptPage(shareId, 'Invalid password'), 401);
      }

      // Reset rate limit on successful auth
      await rateLimiter.resetLimit(clientIP);
    }

    // Update view count and last accessed
    await storage.updateShareMetadata(shareId, {
      viewCount: shareInfo.viewCount + 1,
      lastAccessed: new Date()
    });

    // Render markdown content
    const htmlContent = await marked.parse(shareInfo.content);

    // Generate table of contents if there are headings
    const toc = generateTableOfContents(shareInfo.content);

    // Render the share page
    return c.html(
      renderSharePage(shareInfo, htmlContent, toc),
      200,
      {
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"
      }
    );

  } catch (error) {
    Logger.error(c, 'Share page error', error);
    return c.html(renderErrorPage(), 500);
  }
});

/**
 * Generate table of contents from markdown
 */
function generateTableOfContents(markdown: string): string[] {
  const headings: string[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const text = match[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      headings.push(`<li class="toc-${level}"><a href="#${id}">${text}</a></li>`);
    }
  }

  return headings;
}

/**
 * Render share page HTML
 */
function renderSharePage(shareInfo: any, htmlContent: string, toc: string[]): any {
  const { metadata } = shareInfo;

  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${metadata.title} - Social Archiver</title>

  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${metadata.title}">
  <meta property="og:description" content="Shared note from Social Archiver">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Social Archiver">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${metadata.title}">

  <style>
    ${getObsidianStyles()}
  </style>

  <!-- Prism.js for syntax highlighting -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
</head>
<body>
  <div class="share-container">
    <header class="share-header">
      <h1>${metadata.title}</h1>
      <div class="metadata">
        ${metadata.author ? `<span class="author">By ${metadata.author}</span>` : ''}
        <span class="date">Shared ${new Date(shareInfo.createdAt).toLocaleDateString()}</span>
        <span class="views">👁️ ${shareInfo.viewCount} views</span>
      </div>
      ${metadata.tags && metadata.tags.length > 0 ? `
        <div class="tags">
          ${metadata.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('')}
        </div>
      ` : ''}
    </header>

    ${toc.length > 0 ? `
      <nav class="table-of-contents">
        <h2>Table of Contents</h2>
        <ul>
          ${toc.join('\n')}
        </ul>
      </nav>
    ` : ''}

    <main class="content">
      ${htmlContent}
    </main>

    <footer class="share-footer">
      <p>Archived with <a href="https://social-archiver.com" target="_blank">Social Archiver</a></p>
      <p class="disclaimer">⚠️ This content was archived from social media. Original source and copyright belong to the original author.</p>
    </footer>
  </div>

  <script>
    // Add copy buttons to code blocks
    document.querySelectorAll('pre code').forEach((block) => {
      const button = document.createElement('button');
      button.className = 'copy-button';
      button.textContent = 'Copy';
      button.onclick = () => {
        navigator.clipboard.writeText(block.textContent);
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy', 2000);
      };
      block.parentElement.appendChild(button);
    });

    // Smooth scroll for TOC links
    document.querySelectorAll('.table-of-contents a').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Render password prompt page
 */
function renderPasswordPromptPage(shareId: string, error?: string): any {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Password Required - Social Archiver</title>
  <style>
    ${getObsidianStyles()}
  </style>
</head>
<body>
  <div class="password-prompt">
    <h1>🔒 Password Required</h1>
    <p>This shared note is password protected.</p>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="get">
      <input
        type="password"
        name="password"
        placeholder="Enter password"
        required
        autofocus
      />
      <button type="submit">Access</button>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Render not found page
 */
function renderNotFoundPage(): any {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found - Social Archiver</title>
  <style>
    ${getObsidianStyles()}
  </style>
</head>
<body>
  <div class="error-page">
    <h1>404</h1>
    <p>Share link not found or expired.</p>
    <a href="https://social-archiver.com">Return to Social Archiver</a>
  </div>
</body>
</html>`;
}

/**
 * Render expired page
 */
function renderExpiredPage(): any {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expired - Social Archiver</title>
  <style>
    ${getObsidianStyles()}
  </style>
</head>
<body>
  <div class="error-page">
    <h1>⏰ Link Expired</h1>
    <p>This share link has expired and is no longer accessible.</p>
    <a href="https://social-archiver.com">Return to Social Archiver</a>
  </div>
</body>
</html>`;
}

/**
 * Render rate limit page
 */
function renderRateLimitPage(): any {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Too Many Attempts - Social Archiver</title>
  <style>
    ${getObsidianStyles()}
  </style>
</head>
<body>
  <div class="error-page">
    <h1>🚫 Too Many Attempts</h1>
    <p>You have exceeded the maximum number of password attempts.</p>
    <p>Please try again in 1 hour.</p>
  </div>
</body>
</html>`;
}

/**
 * Render error page
 */
function renderErrorPage(): any {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Social Archiver</title>
  <style>
    ${getObsidianStyles()}
  </style>
</head>
<body>
  <div class="error-page">
    <h1>❌ Something Went Wrong</h1>
    <p>An error occurred while loading this shared note.</p>
    <a href="https://social-archiver.com">Return to Social Archiver</a>
  </div>
</body>
</html>`;
}

/**
 * Get Obsidian-compatible styles
 */
function getObsidianStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #dcddde;
      background: #202020;
      padding: 20px;
    }

    .share-container {
      max-width: 800px;
      margin: 0 auto;
      background: #2a2a2a;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    .share-header {
      border-bottom: 2px solid #3a3a3a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .share-header h1 {
      font-size: 2.5em;
      margin-bottom: 15px;
      color: #ffffff;
    }

    .metadata {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      font-size: 0.9em;
      color: #a0a0a0;
    }

    .tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .tag {
      background: #3a3a3a;
      color: #7c7c7c;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
    }

    .table-of-contents {
      background: #2e2e2e;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .table-of-contents h2 {
      font-size: 1.3em;
      margin-bottom: 15px;
      color: #ffffff;
    }

    .table-of-contents ul {
      list-style: none;
    }

    .table-of-contents a {
      color: #7c7c7c;
      text-decoration: none;
      transition: color 0.2s;
    }

    .table-of-contents a:hover {
      color: #ffffff;
    }

    .toc-2 { padding-left: 20px; }
    .toc-3 { padding-left: 40px; }
    .toc-4 { padding-left: 60px; }

    .content {
      font-size: 1.1em;
      line-height: 1.8;
    }

    .content h1, .content h2, .content h3, .content h4 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #ffffff;
    }

    .content p {
      margin-bottom: 1em;
    }

    .content a {
      color: #7c7c7c;
      text-decoration: underline;
    }

    .content pre {
      position: relative;
      background: #1e1e1e;
      padding: 20px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1.5em 0;
    }

    .copy-button {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 6px 12px;
      background: #3a3a3a;
      color: #dcddde;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }

    .copy-button:hover {
      background: #4a4a4a;
    }

    .share-footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #3a3a3a;
      text-align: center;
      color: #a0a0a0;
      font-size: 0.9em;
    }

    .disclaimer {
      margin-top: 10px;
      font-size: 0.85em;
    }

    .password-prompt, .error-page {
      max-width: 500px;
      margin: 100px auto;
      background: #2a2a2a;
      padding: 40px;
      border-radius: 8px;
      text-align: center;
    }

    .password-prompt h1, .error-page h1 {
      font-size: 2em;
      margin-bottom: 20px;
      color: #ffffff;
    }

    .password-prompt form {
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .password-prompt input {
      padding: 12px;
      border: 1px solid #3a3a3a;
      border-radius: 6px;
      background: #1e1e1e;
      color: #dcddde;
      font-size: 1em;
    }

    .password-prompt button {
      padding: 12px;
      background: #7c7c7c;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
    }

    .password-prompt button:hover {
      background: #8c8c8c;
    }

    .error {
      background: #3d1f1f;
      color: #ff6b6b;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 20px;
    }

    @media (max-width: 768px) {
      body {
        padding: 10px;
      }

      .share-container {
        padding: 20px;
      }

      .share-header h1 {
        font-size: 1.8em;
      }
    }
  `;
}
