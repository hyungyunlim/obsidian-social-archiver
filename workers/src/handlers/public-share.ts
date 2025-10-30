import { Hono } from 'hono';
import { html, raw } from 'hono/html';
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

    // Render the share page (no TOC)
    return c.html(
      renderSharePage(shareInfo, htmlContent, []),
      200,
      {
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://cdnjs.cloudflare.com; img-src * data: blob:;"
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
 * Get platform icon SVG
 */
function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 3.667h-3.533v7.98H9.101z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 0 0-2.124 1.388 5.878 5.878 0 0 0-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 0 0 2.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 0 0 2.123-1.388 5.881 5.881 0 0 0 1.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 0 0-1.387-2.123 5.857 5.857 0 0 0-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 0 1-1.382-.895 3.695 3.695 0 0 1-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 0 1 1.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 0 1-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.848.08-3.204.005-3.584-.006-4.848-.062m9.783-16.192a1.44 1.44 0 1 0 1.437-1.442 1.44 1.44 0 0 0-1.437 1.442M5.839 12.012a6.161 6.161 0 1 0 12.323-.024 6.162 6.162 0 0 0-12.323.024M8 12.008A4 4 0 1 1 12.008 16 4 4 0 0 1 8 12.008"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
    threads: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.989 12.614a7.45 7.45 0 0 0-.102-.854c-.399-2.124-1.648-3.575-3.696-4.31-.735-.266-1.55-.41-2.435-.432l-.39-.006c-1.598 0-2.996.396-4.156 1.176-1.457.982-2.46 2.54-2.981 4.627-.11.438-.193.894-.248 1.358l-.023.206a11.86 11.86 0 0 0-.022.847v.18c.006.436.026.876.06 1.316.092.84.256 1.663.49 2.45.52 2.089 1.522 3.647 2.98 4.628 1.16.782 2.558 1.178 4.156 1.178l.39-.006c.896-.023 1.714-.168 2.435-.432 1.885-.677 3.194-1.993 3.89-3.913.28-.791.455-1.623.516-2.476l.019-.252a10.57 10.57 0 0 0-.014-1.126 10.428 10.428 0 0 0-.062-.727h-.01a10.552 10.552 0 0 0-.073-.587zm-4.787-3.182c1.331.475 2.23 1.464 2.668 2.938.036.137.066.276.09.417a7.362 7.362 0 0 1-2.048.845c-.37.095-.75.165-1.138.206a6.347 6.347 0 0 1-.925.065 5.053 5.053 0 0 1-.912-.083 5.74 5.74 0 0 1-.942-.223 4.798 4.798 0 0 1-1.828-1.097 3.714 3.714 0 0 1-.857-1.345 3.605 3.605 0 0 1-.246-1.313c0-.98.295-1.782.876-2.383.58-.599 1.341-.946 2.263-1.032l.19-.014a5.16 5.16 0 0 1 1.64.178 4.698 4.698 0 0 1 1.41.562c.224.131.437.276.64.434z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
  };

  const platformKey = platform.toLowerCase();
  return icons[platformKey] || icons['x'] || ''; // Default to X if platform not found
}

/**
 * Format relative time (matching plugin's getRelativeTime)
 */
function getRelativeTime(timestamp: Date): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay === 1) {
    return 'Yesterday';
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

/**
 * Render share page HTML
 */
function renderSharePage(shareInfo: any, htmlContent: string, toc: string[]): any {
  const { metadata } = shareInfo;
  const relativeTime = getRelativeTime(new Date(shareInfo.createdAt));

  // Prepare content with see more/less functionality
  const cleanContent = htmlContent.trim();
  const previewLength = 500;
  const isLongContent = cleanContent.length > previewLength;

  let previewContent = cleanContent;
  if (isLongContent) {
    // Find a good breaking point (avoid breaking in the middle of HTML tags)
    const cutPoint = cleanContent.lastIndexOf('</p>', previewLength);
    if (cutPoint > 0 && cutPoint > previewLength - 200) {
      previewContent = cleanContent.substring(0, cutPoint + 4) + '...';
    } else {
      previewContent = cleanContent.substring(0, previewLength) + '...';
    }
  }

  const seeMoreButton = isLongContent
    ? '<button id="seeMoreBtn">See more</button>'
    : '';

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
    ${raw(getInlineStyles())}
  </style>

  <!-- Prism.js for syntax highlighting -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
</head>
<body>
  <div class="container">
    <div class="card-wrapper">
      <div id="postCard" class="post-card">
        <!-- Platform icon (top right) -->
        <div id="platformBadge" class="platform-badge">
          <div class="platform-icon">
            ${raw(getPlatformIcon(metadata.platform))}
          </div>
        </div>

        <!-- Content area -->
        <div class="content-area">
          <!-- Header: Author + Time -->
          <div class="header">
            <strong class="author-name">${metadata.author || 'Unknown'}</strong>
            <div class="post-time">${relativeTime}</div>
          </div>

          <!-- Content -->
          <div class="content-wrapper">
            <div class="content-text" id="contentText">
              ${raw(isLongContent ? previewContent : cleanContent)}
            </div>
            ${raw(seeMoreButton)}
          </div>

          <!-- Footer interaction bar -->
          <div class="interactions">
            <div class="spacer"></div>
            <a href="${metadata.originalUrl}" target="_blank" rel="noopener noreferrer" class="action-link" title="View original post">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer badge -->
  <div class="page-footer">
    <span class="footer-text">Archived with Social Archiver</span>
  </div>

  <script>
    // See more/less functionality
    const fullContent = ${JSON.stringify(cleanContent)};
    const previewContentStr = ${JSON.stringify(previewContent)};
    const contentText = document.getElementById('contentText');
    const seeMoreBtn = document.getElementById('seeMoreBtn');
    let expanded = false;

    if (seeMoreBtn) {
      seeMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        expanded = !expanded;
        if (expanded) {
          contentText.innerHTML = fullContent;
          seeMoreBtn.textContent = 'See less';
        } else {
          contentText.innerHTML = previewContentStr;
          seeMoreBtn.textContent = 'See more';
        }
      });
    }

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

    // Hover effect for card
    const card = document.getElementById('postCard');
    if (card) {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        card.style.backgroundColor = '#252525';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
        card.style.backgroundColor = '#202020';
      });
    }

    // Hover effect for platform badge
    const badge = document.getElementById('platformBadge');
    if (badge) {
      badge.addEventListener('mouseenter', () => {
        badge.style.opacity = '0.6';
      });
      badge.addEventListener('mouseleave', () => {
        badge.style.opacity = '0.3';
      });
    }
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
    ${raw(getSimplePageStyles())}
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
    ${raw(getSimplePageStyles())}
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
    ${raw(getSimplePageStyles())}
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
    ${raw(getSimplePageStyles())}
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
    ${raw(getSimplePageStyles())}
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
 * Get simple page styles (for error/password pages)
 */
function getSimplePageStyles(): string {
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

    .password-prompt, .error-page {
      max-width: 500px;
      margin: 100px auto;
      background: #161616;
      padding: 40px;
      border-radius: 12px;
      text-align: center;
    }

    .password-prompt h1, .error-page h1 {
      font-size: 2em;
      margin-bottom: 20px;
      color: #dcddde;
    }

    .password-prompt p, .error-page p {
      color: #999;
      margin-bottom: 1em;
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
      background: #1a1a1a;
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
      transition: opacity 0.2s;
    }

    .password-prompt button:hover {
      opacity: 0.8;
    }

    .error {
      background: rgba(255, 107, 107, 0.1);
      color: #ff6b6b;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 20px;
      border: 1px solid rgba(255, 107, 107, 0.2);
    }

    .error-page a {
      color: #7c7c7c;
      text-decoration: none;
      display: inline-block;
      margin-top: 20px;
    }

    .error-page a:hover {
      text-decoration: underline;
    }
  `;
}

/**
 * Get inline styles (complete CSS without Tailwind)
 */
function getInlineStyles(): string {
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

    .container {
      max-width: 680px;
      margin: 0 auto;
    }

    .card-wrapper {
      margin-bottom: 16px;
    }

    .post-card {
      position: relative;
      padding: 16px;
      border-radius: 8px;
      background: #202020;
      transition: all 0.2s;
      border: 1px solid #3a3a3a;
    }

    .platform-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.3;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .platform-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #7c7c7c;
    }

    .platform-badge svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }

    .content-area {
      padding-right: 56px;
    }

    .header {
      margin-bottom: 12px;
    }

    .author-name {
      display: block;
      margin-bottom: 4px;
      font-size: 1rem;
      font-weight: 600;
      color: #dcddde;
      cursor: pointer;
      transition: color 0.2s;
    }

    .author-name:hover {
      color: #7c7c7c;
    }

    .post-time {
      font-size: 0.875rem;
      color: #999;
    }

    .content-wrapper {
      margin-bottom: 12px;
    }

    .content-text {
      font-size: 1rem;
      line-height: 1.7;
      color: #dcddde;
      white-space: pre-wrap;
      word-break: break-word;
    }

    #seeMoreBtn {
      font-size: 0.875rem;
      color: #999;
      margin-top: 8px;
      display: inline-block;
      cursor: pointer;
      transition: color 0.2s;
      background: transparent;
      border: none;
      padding: 0;
      font-family: inherit;
    }

    #seeMoreBtn:hover {
      color: #7c7c7c;
    }

    .interactions {
      display: flex;
      align-items: center;
      gap: 24px;
      padding-top: 12px;
      margin-top: 12px;
      border-top: 1px solid #3a3a3a;
      color: #999;
      flex-wrap: wrap;
    }

    .spacer {
      flex: 1;
    }

    .action-link {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      color: #999;
      cursor: pointer;
      transition: color 0.2s;
      text-decoration: none;
    }

    .action-link:hover {
      color: #7c7c7c;
    }

    .action-link svg {
      flex-shrink: 0;
    }

    .page-footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #666;
      font-size: 0.8125rem;
    }

    .footer-text {
      opacity: 0.6;
    }

    /* Content text styling */
    #contentText h1, #contentText h2, #contentText h3 {
      margin-top: 1.5em;
      margin-bottom: 0.75em;
      color: #dcddde;
      font-weight: 600;
      font-size: 1.2em;
    }

    #contentText h2 {
      font-size: 1.4em;
      padding-bottom: 0.4em;
      border-bottom: 1px solid #3a3a3a;
    }

    #contentText p {
      margin-bottom: 0.3em;
      font-size: 1rem;
      line-height: 1.5;
    }

    #contentText p:last-child {
      margin-bottom: 0;
    }

    #contentText a {
      color: #7c7c7c;
      text-decoration: underline;
      word-break: break-word;
    }

    #contentText img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 10px 0;
      display: block;
    }

    #contentText ul, #contentText ol {
      margin: 0.3em 0;
      padding-left: 1.5em;
    }

    #contentText li {
      margin-bottom: 0.1em;
      line-height: 1.4;
    }

    #contentText li:last-child {
      margin-bottom: 0;
    }

    #contentText hr {
      border: none;
      border-top: 1px solid #3a3a3a;
      margin: 20px 0;
    }

    #contentText pre {
      background: #1a1a1a;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 16px 0;
      position: relative;
    }

    #contentText code {
      background: #1a1a1a;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    #contentText pre code {
      padding: 0;
    }

    /* Code copy button */
    .copy-button {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      font-size: 0.75rem;
      background: #3a3a3a;
      color: #999;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .copy-button:hover {
      opacity: 0.8;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }

      .post-card {
        padding: 12px;
      }

      .content-area {
        padding-right: 44px;
      }

      .platform-badge {
        width: 36px;
        height: 36px;
        top: 10px;
        right: 10px;
      }

      .platform-icon {
        width: 18px;
        height: 18px;
      }

      .interactions {
        gap: 16px;
      }
    }
  `;
}
