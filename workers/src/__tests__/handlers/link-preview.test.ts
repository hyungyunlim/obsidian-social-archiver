import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  linkPreviewRouter,
  validateUrl,
  fetchHtml,
  extractMetadata,
  normalizeUrl,
  generateCacheKey,
  getCachedPreview,
  setCachedPreview,
  CACHE_CONFIG
} from '@/handlers/link-preview';
import type { Bindings } from '@/types/bindings';
import { Logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';

// Mock Logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setContext: vi.fn(),
} as unknown as Logger;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Link Preview Handler', () => {
  let app: Hono;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    app = new Hono();

    // Mock logger middleware
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      await next();
    });

    app.route('/api/link-preview', linkPreviewRouter);

    // Add error handler
    app.onError(errorHandler);

    mockEnv = {
      // Add KV namespaces when needed for caching
    };

    vi.clearAllMocks();
  });

  describe('POST /api/link-preview', () => {
    it('should return 400 for missing URL', async () => {
      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid URL format', async () => {
      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-valid-url' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);
    });

    it('should accept valid HTTP URL', async () => {
      // Mock fetch for HTML fetching
      const mockHtml = '<html><head><title>Test</title></head><body>Content</body></html>';
      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://example.com/article' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.url).toBe('http://example.com/article');
    });

    it('should accept valid HTTPS URL', async () => {
      // Mock fetch for HTML fetching
      const mockHtml = '<html><body>Content</body></html>';
      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://techcrunch.com/article' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/link-preview/health', () => {
    it('should return health status', async () => {
      const req = new Request('http://localhost/api/link-preview/health');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.service).toBe('link-preview');
      expect(json.data.status).toBe('operational');
    });
  });
});

describe('validateUrl', () => {
  it('should accept valid HTTP/HTTPS URLs', () => {
    expect(() => validateUrl('http://example.com', mockLogger)).not.toThrow();
    expect(() => validateUrl('https://example.com', mockLogger)).not.toThrow();
    expect(() => validateUrl('https://example.com:8080/path', mockLogger)).not.toThrow();
  });

  it('should reject non-HTTP/HTTPS schemes', () => {
    expect(() => validateUrl('ftp://example.com', mockLogger)).toThrow('Invalid URL scheme');
    expect(() => validateUrl('file:///etc/passwd', mockLogger)).toThrow('Invalid URL scheme');
    expect(() => validateUrl('javascript:alert(1)', mockLogger)).toThrow('Invalid URL scheme');
    expect(() => validateUrl('data:text/html,<script>alert(1)</script>', mockLogger)).toThrow('Invalid URL scheme');
  });

  it('should reject localhost', () => {
    expect(() => validateUrl('http://localhost', mockLogger)).toThrow('Access to this hostname is not allowed');
    expect(() => validateUrl('https://localhost:8080', mockLogger)).toThrow('Access to this hostname is not allowed');
  });

  it('should reject loopback IPs (127.0.0.0/8)', () => {
    expect(() => validateUrl('http://127.0.0.1', mockLogger)).toThrow('Access to private IP addresses is not allowed');
    expect(() => validateUrl('http://127.0.0.2', mockLogger)).toThrow('Access to private IP addresses is not allowed');
    expect(() => validateUrl('http://127.255.255.255', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject private IPs (10.0.0.0/8)', () => {
    expect(() => validateUrl('http://10.0.0.1', mockLogger)).toThrow('Access to private IP addresses is not allowed');
    expect(() => validateUrl('http://10.255.255.255', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject private IPs (172.16.0.0/12)', () => {
    expect(() => validateUrl('http://172.16.0.1', mockLogger)).toThrow('Access to private IP addresses is not allowed');
    expect(() => validateUrl('http://172.31.255.255', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject private IPs (192.168.0.0/16)', () => {
    expect(() => validateUrl('http://192.168.0.1', mockLogger)).toThrow('Access to private IP addresses is not allowed');
    expect(() => validateUrl('http://192.168.255.255', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject link-local IPs (169.254.0.0/16)', () => {
    expect(() => validateUrl('http://169.254.0.1', mockLogger)).toThrow('Access to private IP addresses is not allowed');
    // 169.254.169.254 is in BLOCKED_HOSTNAMES, so different error message
    expect(() => validateUrl('http://169.254.169.254', mockLogger)).toThrow('Access to this hostname is not allowed');
  });

  it('should reject cloud metadata endpoints', () => {
    expect(() => validateUrl('http://metadata.google.internal', mockLogger)).toThrow('Access to this hostname is not allowed');
    // 169.254.169.254 is in BLOCKED_HOSTNAMES, so different error message
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data', mockLogger)).toThrow('Access to this hostname is not allowed');
  });

  it('should reject IPv6 loopback', () => {
    expect(() => validateUrl('http://[::1]', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject IPv6 link-local', () => {
    expect(() => validateUrl('http://[fe80::1]', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject IPv6 unique local', () => {
    expect(() => validateUrl('http://[fc00::1]', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should accept public IPs', () => {
    expect(() => validateUrl('http://8.8.8.8', mockLogger)).not.toThrow();
    expect(() => validateUrl('http://1.1.1.1', mockLogger)).not.toThrow();
    expect(() => validateUrl('http://142.250.185.206', mockLogger)).not.toThrow(); // google.com
  });

  it('should accept public domains', () => {
    expect(() => validateUrl('https://example.com', mockLogger)).not.toThrow();
    expect(() => validateUrl('https://google.com', mockLogger)).not.toThrow();
    expect(() => validateUrl('https://github.com', mockLogger)).not.toThrow();
  });

  it('should reject malformed URLs', () => {
    expect(() => validateUrl('not-a-url', mockLogger)).toThrow('Invalid URL format');
    expect(() => validateUrl('', mockLogger)).toThrow('Invalid URL format');
    expect(() => validateUrl('http://', mockLogger)).toThrow('Invalid URL format');
  });

  it('should handle URLs with query parameters', () => {
    expect(() => validateUrl('https://example.com/path?query=value', mockLogger)).not.toThrow();
  });

  it('should handle URLs with fragments', () => {
    expect(() => validateUrl('https://example.com/path#section', mockLogger)).not.toThrow();
  });

  it('should handle URLs with authentication', () => {
    expect(() => validateUrl('https://user:pass@example.com', mockLogger)).not.toThrow();
  });
});

describe('fetchHtml', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useRealTimers(); // Use real timers for most tests
  });

  it('should fetch HTML successfully', async () => {
    const mockHtml = '<html><head><title>Test</title></head><body>Content</body></html>';

    const mockHeaders = new Headers();
    mockHeaders.set('content-type', 'text/html');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: mockHeaders,
      text: async () => mockHtml,
    });

    const html = await fetchHtml('https://example.com', mockLogger);

    expect(html).toBe(mockHtml);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      })
    );
  });

  it('should follow redirects (single redirect)', async () => {
    // First request: redirect
    const redirectHeaders = new Headers();
    redirectHeaders.set('location', 'https://example.com/redirected');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 301,
      headers: redirectHeaders,
    });

    // Second request: success
    const mockHtml = '<html><body>Redirected content</body></html>';
    const successHeaders = new Headers();
    successHeaders.set('content-type', 'text/html');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: successHeaders,
      text: async () => mockHtml,
    });

    const html = await fetchHtml('https://example.com', mockLogger);

    expect(html).toBe(mockHtml);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle relative redirects', async () => {
    // First request: relative redirect
    const redirectHeaders = new Headers();
    redirectHeaders.set('location', '/redirected-page');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: redirectHeaders,
    });

    // Second request: success
    const mockHtml = '<html><body>Redirected</body></html>';
    const successHeaders = new Headers();
    successHeaders.set('content-type', 'text/html');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: successHeaders,
      text: async () => mockHtml,
    });

    const html = await fetchHtml('https://example.com/original', mockLogger);

    expect(html).toBe(mockHtml);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://example.com/redirected-page',
      expect.anything()
    );
  });

  it('should reject too many redirects', async () => {
    // Mock 4 redirects (exceeds limit of 3)
    for (let i = 0; i < 4; i++) {
      const headers = new Headers();
      headers.set('location', `https://example.com/redirect${i + 1}`);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 301,
        headers,
      });
    }

    await expect(fetchHtml('https://example.com', mockLogger, 3)).rejects.toThrow('Too many redirects');
  });

  it('should reject redirect to private IP', async () => {
    // Redirect to private IP
    const headers = new Headers();
    headers.set('location', 'http://192.168.1.1');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 301,
      headers,
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Access to private IP addresses is not allowed');
  });

  it('should handle 404 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Page not found (404)');
  });

  it('should handle 403 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Access forbidden (403)');
  });

  it('should handle 500 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Server error (500)');
  });

  it('should validate content-type is HTML', async () => {
    const headers = new Headers();
    headers.set('content-type', 'application/json');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers,
      text: async () => '{"data": "json"}',
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Invalid content type');
  });

  it('should accept various HTML content types', async () => {
    const mockHtml = '<html><body>Test</body></html>';

    // Test text/html
    const headers1 = new Headers();
    headers1.set('content-type', 'text/html; charset=utf-8');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: headers1,
      text: async () => mockHtml,
    });
    await expect(fetchHtml('https://example.com', mockLogger)).resolves.toBe(mockHtml);

    // Test application/xhtml+xml
    const headers2 = new Headers();
    headers2.set('content-type', 'application/xhtml+xml');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: headers2,
      text: async () => mockHtml,
    });
    await expect(fetchHtml('https://example.com', mockLogger)).resolves.toBe(mockHtml);
  });

  it('should reject content exceeding size limit', async () => {
    const headers = new Headers();
    headers.set('content-type', 'text/html');
    headers.set('content-length', '20000000'); // 20MB

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers,
      text: async () => '<html>Content</html>',
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Content too large');
  });

  it('should reject content exceeding size limit after reading', async () => {
    // Content-length header not set, but actual content is too large
    const largeHtml = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const headers = new Headers();
    headers.set('content-type', 'text/html');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers,
      text: async () => largeHtml,
    });

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Content too large');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    await expect(fetchHtml('https://example.com', mockLogger)).rejects.toThrow('Network error');
  });
});

describe('extractMetadata', () => {
  it('should extract Open Graph metadata (priority 1)', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="OG Title" />
          <meta property="og:description" content="OG Description" />
          <meta property="og:image" content="https://example.com/og-image.jpg" />
          <meta property="og:site_name" content="Example Site" />
          <title>HTML Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('OG Title');
    expect(metadata.description).toBe('OG Description');
    expect(metadata.image).toBe('https://example.com/og-image.jpg');
    expect(metadata.siteName).toBe('Example Site');
  });

  it('should fall back to Twitter Cards (priority 2)', () => {
    const html = `
      <html>
        <head>
          <meta name="twitter:title" content="Twitter Title" />
          <meta name="twitter:description" content="Twitter Description" />
          <meta name="twitter:image" content="https://example.com/twitter-image.jpg" />
          <title>HTML Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('Twitter Title');
    expect(metadata.description).toBe('Twitter Description');
    expect(metadata.image).toBe('https://example.com/twitter-image.jpg');
  });

  it('should prioritize OG over Twitter', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="OG Title" />
          <meta name="twitter:title" content="Twitter Title" />
          <title>HTML Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('OG Title');
  });

  it('should fall back to HTML title (priority 4)', () => {
    const html = `
      <html>
        <head>
          <title>HTML Title Only</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('HTML Title Only');
  });

  it('should fall back to domain name if no title found', () => {
    const html = '<html><head></head><body></body></html>';

    const metadata = extractMetadata(html, 'https://www.example.com/path', mockLogger);

    expect(metadata.title).toBe('example.com');
    expect(metadata.siteName).toBe('example.com');
  });

  it('should extract standard meta description (priority 3)', () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="Standard Description" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.description).toBe('Standard Description');
  });

  it('should extract favicon', () => {
    const html = `
      <html>
        <head>
          <link rel="icon" href="/favicon.ico" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.favicon).toBe('https://example.com/favicon.ico');
  });

  it('should handle shortcut icon', () => {
    const html = `
      <html>
        <head>
          <link rel="shortcut icon" href="https://example.com/icon.png" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.favicon).toBe('https://example.com/icon.png');
  });

  it('should fall back to default favicon path', () => {
    const html = '<html><head><title>Title</title></head><body></body></html>';

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.favicon).toBe('https://example.com/favicon.ico');
  });

  it('should resolve relative image URLs', () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="/images/og-image.jpg" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.image).toBe('https://example.com/images/og-image.jpg');
  });

  it('should handle protocol-relative URLs', () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="//cdn.example.com/image.jpg" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.image).toBe('https://cdn.example.com/image.jpg');
  });

  it('should decode HTML entities in content', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Title &amp; Subtitle &quot;Quoted&quot;" />
          <meta property="og:description" content="Description with &lt;tags&gt; and &apos;quotes&apos;" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('Title & Subtitle "Quoted"');
    expect(metadata.description).toBe("Description with <tags> and 'quotes'");
  });

  it('should handle numeric HTML entities', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Title with &#8220;smart quotes&#8221; and &#169; symbol" />
          <title>Title</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    // Check that smart quotes were decoded (Unicode 8220 = left double quotation mark)
    expect(metadata.title).toContain('smart quotes');
    expect(metadata.title).toContain('©');
  });

  it('should handle attribute order variations', () => {
    // content before property
    const html1 = `<html><head><meta content="Test Title" property="og:title" /><title>Title</title></head></html>`;
    const metadata1 = extractMetadata(html1, 'https://example.com', mockLogger);
    expect(metadata1.title).toBe('Test Title');

    // property before content
    const html2 = `<html><head><meta property="og:title" content="Test Title" /><title>Title</title></head></html>`;
    const metadata2 = extractMetadata(html2, 'https://example.com', mockLogger);
    expect(metadata2.title).toBe('Test Title');
  });

  it('should handle missing optional fields', () => {
    const html = `
      <html>
        <head>
          <title>Title Only</title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('Title Only');
    expect(metadata.description).toBeUndefined();
    expect(metadata.image).toBeUndefined();
  });

  it('should handle empty title tag', () => {
    const html = `
      <html>
        <head>
          <title></title>
        </head>
        <body></body>
      </html>
    `;

    const metadata = extractMetadata(html, 'https://example.com', mockLogger);

    expect(metadata.title).toBe('example.com');
  });
});

describe('Error Handling and Response Formatting', () => {
  let app: Hono;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    app = new Hono();

    // Mock logger middleware
    app.use('*', async (c, next) => {
      c.set('logger', mockLogger);
      await next();
    });

    app.route('/api/link-preview', linkPreviewRouter);

    // Add error handler
    app.onError(errorHandler);

    mockEnv = {};

    mockFetch.mockReset();
    vi.useRealTimers();
  });

  describe('POST /api/link-preview error scenarios', () => {
    it('should return 400 for private IP URL', async () => {
      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://192.168.1.1/test' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect(json.error.message).toContain('private IP');
    });

    it('should return 400 for invalid URL scheme', async () => {
      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'ftp://example.com' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('scheme');
    });

    it('should return 400 when HTML fetch times out', async () => {
      // Mock AbortError immediately to simulate timeout
      const abortError = new Error('Request timeout after 5000ms');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://slow-site.com' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 for non-HTML content type', async () => {
      const headers = new Headers();
      headers.set('content-type', 'application/pdf');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => 'PDF content',
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/document.pdf' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('content type');
    });

    it('should return 400 for 404 pages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/not-found' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('404');
    });

    it('should return 400 for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://unreachable-site.com' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });
  });

  describe('Successful response formatting', () => {
    it('should return standardized success response with all metadata fields', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Test Article" />
            <meta property="og:description" content="A great article" />
            <meta property="og:image" content="https://example.com/image.jpg" />
            <meta property="og:site_name" content="Example" />
            <link rel="icon" href="/favicon.ico" />
            <title>Test</title>
          </head>
        </html>
      `;

      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/article' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toMatchObject({
        success: true,
        data: {
          url: 'https://example.com/article',
          title: 'Test Article',
          description: 'A great article',
          image: 'https://example.com/image.jpg',
          siteName: 'Example',
          favicon: 'https://example.com/favicon.ico'
        }
      });
    });

    it('should return success response with fallback values for missing metadata', async () => {
      const mockHtml = '<html><head><title>Simple Page</title></head><body></body></html>';

      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' })
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Simple Page');
      expect(json.data.siteName).toBe('example.com');
      expect(json.data.favicon).toBe('https://example.com/favicon.ico');
      expect(json.data.description).toBeUndefined();
      expect(json.data.image).toBeUndefined();
    });

    it('should include Content-Type header in response', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' })
      });

      const res = await app.request(req, mockEnv);

      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });
});

describe('Cache Key Strategy and URL Normalization', () => {
  describe('CACHE_CONFIG constants', () => {
    it('should have correct TTL value (7 days)', () => {
      expect(CACHE_CONFIG.TTL).toBe(604800); // 7 days = 7 * 24 * 60 * 60
    });

    it('should have correct key prefix', () => {
      expect(CACHE_CONFIG.KEY_PREFIX).toBe('preview:');
    });

    it('should have reasonable max key length', () => {
      expect(CACHE_CONFIG.MAX_KEY_LENGTH).toBe(512);
    });
  });

  describe('normalizeUrl', () => {
    it('should convert hostname to lowercase', () => {
      const url = 'https://EXAMPLE.COM/path';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/path');
    });

    it('should remove www. prefix', () => {
      const url = 'https://www.example.com/path';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/path');
    });

    it('should remove fragment identifiers', () => {
      const url = 'https://example.com/path#section';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/path');
    });

    it('should remove trailing slash from pathname', () => {
      const url = 'https://example.com/path/';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/path');
    });

    it('should keep single slash for root path', () => {
      const url = 'https://example.com/';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/');
    });

    it('should remove common tracking parameters', () => {
      const url = 'https://example.com/article?utm_source=twitter&utm_campaign=promo&id=123';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/article?id=123');
    });

    it('should remove all tracking parameters', () => {
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
        '_ga', '_gl', 'ref', 'source'
      ];

      trackingParams.forEach(param => {
        const url = `https://example.com/path?${param}=value&id=123`;
        const normalized = normalizeUrl(url, mockLogger);
        expect(normalized).toBe('https://example.com/path?id=123');
      });
    });

    it('should sort query parameters alphabetically', () => {
      const url = 'https://example.com/path?z=3&a=1&m=2';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/path?a=1&m=2&z=3');
    });

    it('should handle URLs without query parameters', () => {
      const url = 'https://example.com/path';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/path');
    });

    it('should normalize complex URLs correctly', () => {
      const url = 'https://WWW.EXAMPLE.COM/Article/?utm_source=fb&z=last&a=first#heading';
      const normalized = normalizeUrl(url, mockLogger);
      expect(normalized).toBe('https://example.com/Article?a=first&z=last');
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const normalized = normalizeUrl(invalidUrl, mockLogger);
      expect(normalized).toBe(invalidUrl); // Should return original on error
    });

    it('should produce same normalized URL for equivalent URLs', () => {
      const urls = [
        'https://www.example.com/article?utm_source=twitter&id=123#section',
        'https://EXAMPLE.COM/article?id=123&utm_source=fb',
        'https://example.com/article/?id=123',
      ];

      const normalized = urls.map(url => normalizeUrl(url, mockLogger));

      // All should normalize to the same URL
      expect(normalized[0]).toBe(normalized[1]);
      expect(normalized[1]).toBe(normalized[2]);
      expect(normalized[0]).toBe('https://example.com/article?id=123');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate cache key with correct prefix', () => {
      const url = 'https://example.com/article';
      const key = generateCacheKey(url, mockLogger);
      expect(key).toStartWith('preview:');
    });

    it('should generate same key for equivalent URLs', () => {
      const url1 = 'https://www.example.com/article?utm_source=twitter';
      const url2 = 'https://EXAMPLE.COM/article/';

      const key1 = generateCacheKey(url1, mockLogger);
      const key2 = generateCacheKey(url2, mockLogger);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different URLs', () => {
      const url1 = 'https://example.com/article1';
      const url2 = 'https://example.com/article2';

      const key1 = generateCacheKey(url1, mockLogger);
      const key2 = generateCacheKey(url2, mockLogger);

      expect(key1).not.toBe(key2);
    });

    it('should handle very long URLs by hashing', () => {
      // Create a URL longer than MAX_KEY_LENGTH
      const longPath = 'a'.repeat(CACHE_CONFIG.MAX_KEY_LENGTH);
      const longUrl = `https://example.com/${longPath}`;

      const key = generateCacheKey(longUrl, mockLogger);

      // Key should be shorter than original URL
      expect(key.length).toBeLessThan(longUrl.length);

      // Key should start with prefix and contain 'hash:'
      expect(key).toStartWith('preview:hash:');
    });

    it('should generate consistent hashed keys for same long URL', () => {
      const longPath = 'a'.repeat(CACHE_CONFIG.MAX_KEY_LENGTH);
      const longUrl = `https://example.com/${longPath}`;

      const key1 = generateCacheKey(longUrl, mockLogger);
      const key2 = generateCacheKey(longUrl, mockLogger);

      expect(key1).toBe(key2);
    });

    it('should respect MAX_KEY_LENGTH limit', () => {
      const urls = [
        'https://example.com/short',
        'https://example.com/' + 'a'.repeat(100),
        'https://example.com/' + 'a'.repeat(CACHE_CONFIG.MAX_KEY_LENGTH * 2)
      ];

      urls.forEach(url => {
        const key = generateCacheKey(url, mockLogger);
        expect(key.length).toBeLessThanOrEqual(CACHE_CONFIG.MAX_KEY_LENGTH);
      });
    });

    it('should handle query parameters in cache key generation', () => {
      const url1 = 'https://example.com/article?id=123&sort=asc';
      const url2 = 'https://example.com/article?sort=asc&id=123';

      const key1 = generateCacheKey(url1, mockLogger);
      const key2 = generateCacheKey(url2, mockLogger);

      // Should generate same key due to parameter sorting
      expect(key1).toBe(key2);
    });
  });
});

describe('Cache Hit/Miss Logic', () => {
  let mockKV: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('getCachedPreview', () => {
    it('should return null on cache miss', async () => {
      mockKV.get.mockResolvedValueOnce(null);

      const result = await getCachedPreview(
        mockKV as any,
        'https://example.com',
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith(
        expect.stringContaining('preview:'),
        'json'
      );
    });

    it('should return cached data on cache hit', async () => {
      const now = Date.now();
      const cachedData = {
        url: 'https://example.com',
        title: 'Cached Title',
        description: 'Cached Description',
        cachedAt: now - 3600000, // 1 hour ago
        expiresAt: now + 86400000, // 1 day from now
      };

      mockKV.get.mockResolvedValueOnce(cachedData);

      const result = await getCachedPreview(
        mockKV as any,
        'https://example.com',
        mockLogger
      );

      expect(result).toEqual(cachedData);
      expect(result?.title).toBe('Cached Title');
    });

    it('should delete expired cache entries', async () => {
      const now = Date.now();
      const expiredData = {
        url: 'https://example.com',
        title: 'Expired Title',
        cachedAt: now - 10000000,
        expiresAt: now - 1000, // Expired 1 second ago
      };

      mockKV.get.mockResolvedValueOnce(expiredData);
      mockKV.delete.mockResolvedValueOnce(undefined);

      const result = await getCachedPreview(
        mockKV as any,
        'https://example.com',
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockKV.delete).toHaveBeenCalledWith(
        expect.stringContaining('preview:')
      );
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.get.mockRejectedValueOnce(new Error('KV connection failed'));

      const result = await getCachedPreview(
        mockKV as any,
        'https://example.com',
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache lookup failed',
        expect.objectContaining({
          url: 'https://example.com',
          error: 'KV connection failed'
        })
      );
    });
  });

  describe('setCachedPreview', () => {
    it('should store metadata in cache with TTL', async () => {
      const metadata = {
        url: 'https://example.com',
        title: 'Test Title',
        description: 'Test Description',
      };

      mockKV.put.mockResolvedValueOnce(undefined);

      await setCachedPreview(
        mockKV as any,
        'https://example.com',
        metadata,
        mockLogger
      );

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('preview:'),
        expect.stringContaining('"title":"Test Title"'),
        { expirationTtl: CACHE_CONFIG.TTL }
      );
    });

    it('should include cachedAt and expiresAt timestamps', async () => {
      const metadata = {
        url: 'https://example.com',
        title: 'Test Title',
      };

      mockKV.put.mockResolvedValueOnce(undefined);

      await setCachedPreview(
        mockKV as any,
        'https://example.com',
        metadata,
        mockLogger
      );

      const putCall = mockKV.put.mock.calls[0];
      const storedData = JSON.parse(putCall[1]);

      expect(storedData).toHaveProperty('cachedAt');
      expect(storedData).toHaveProperty('expiresAt');
      expect(storedData.expiresAt).toBeGreaterThan(storedData.cachedAt);
    });

    it('should retry on failure with exponential backoff', async () => {
      const metadata = {
        url: 'https://example.com',
        title: 'Test Title',
      };

      // Fail twice, succeed on third attempt
      mockKV.put
        .mockRejectedValueOnce(new Error('KV write failed'))
        .mockRejectedValueOnce(new Error('KV write failed'))
        .mockResolvedValueOnce(undefined);

      await setCachedPreview(
        mockKV as any,
        'https://example.com',
        metadata,
        mockLogger,
        2 // maxRetries
      );

      expect(mockKV.put).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cache stored successfully',
        expect.any(Object)
      );
    });

    it('should give up after max retries', async () => {
      const metadata = {
        url: 'https://example.com',
        title: 'Test Title',
      };

      // Always fail
      mockKV.put.mockRejectedValue(new Error('KV permanently unavailable'));

      await setCachedPreview(
        mockKV as any,
        'https://example.com',
        metadata,
        mockLogger,
        2 // maxRetries
      );

      expect(mockKV.put).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache storage abandoned after max retries',
        expect.objectContaining({
          url: 'https://example.com',
          maxRetries: 2
        })
      );
    });

    it('should not throw on storage failure', async () => {
      const metadata = {
        url: 'https://example.com',
        title: 'Test Title',
      };

      mockKV.put.mockRejectedValue(new Error('KV error'));

      // Should not throw
      await expect(
        setCachedPreview(
          mockKV as any,
          'https://example.com',
          metadata,
          mockLogger,
          0 // No retries
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('POST /api/link-preview with caching', () => {
    let app: Hono;
    let mockEnv: Partial<Bindings>;

    beforeEach(() => {
      app = new Hono();

      app.use('*', async (c, next) => {
        c.set('logger', mockLogger);
        await next();
      });

      app.route('/api/link-preview', linkPreviewRouter);
      app.onError(errorHandler);

      mockEnv = {
        ARCHIVE_CACHE: mockKV as any,
      };

      mockFetch.mockReset();
      vi.clearAllMocks();
    });

    it('should return cached data on cache hit', async () => {
      const now = Date.now();
      const cachedData = {
        url: 'https://example.com/article',
        title: 'Cached Article',
        description: 'From cache',
        cachedAt: now - 3600000,
        expiresAt: now + 86400000,
      };

      mockKV.get.mockResolvedValueOnce(cachedData);

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/article' })
      });

      const res = await app.request(req, mockEnv);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.cached).toBe(true);
      expect(json.data.title).toBe('Cached Article');
      expect(json.cacheAge).toBeGreaterThan(0);

      // Should not fetch HTML on cache hit
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch and cache on cache miss', async () => {
      mockKV.get.mockResolvedValueOnce(null); // Cache miss
      mockKV.put.mockResolvedValueOnce(undefined);

      const mockHtml = `
        <html>
          <head>
            <title>Fresh Article</title>
            <meta property="og:description" content="Fresh content" />
          </head>
        </html>
      `;

      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/fresh' })
      });

      const res = await app.request(req, mockEnv);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.cached).toBe(false);
      expect(json.data.title).toBe('Fresh Article');

      // Should fetch HTML on cache miss
      expect(mockFetch).toHaveBeenCalled();

      // Note: setCachedPreview is called in background via waitUntil,
      // so we can't directly test mockKV.put being called in this test
    });

    it('should handle cache lookup errors gracefully', async () => {
      mockKV.get.mockRejectedValueOnce(new Error('KV unavailable'));

      const mockHtml = '<html><head><title>Test</title></head></html>';
      const headers = new Headers();
      headers.set('content-type', 'text/html');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers,
        text: async () => mockHtml,
      });

      const req = new Request('http://localhost/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' })
      });

      const res = await app.request(req, mockEnv);
      const json = await res.json();

      // Should still succeed by fetching fresh data
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.title).toBe('Test');
    });
  });
});
