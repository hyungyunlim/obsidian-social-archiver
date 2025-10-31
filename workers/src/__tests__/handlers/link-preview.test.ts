import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { linkPreviewRouter, validateUrl, fetchHtml } from '@/handlers/link-preview';
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
