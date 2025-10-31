import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { linkPreviewRouter, validateUrl } from '@/handlers/link-preview';
import type { Bindings } from '@/types/bindings';
import { Logger } from '@/utils/logger';

// Mock Logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  setContext: vi.fn(),
} as unknown as Logger;

describe('Link Preview Handler', () => {
  let app: Hono;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/link-preview', linkPreviewRouter);

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
    expect(() => validateUrl('http://169.254.169.254', mockLogger)).toThrow('Access to private IP addresses is not allowed');
  });

  it('should reject cloud metadata endpoints', () => {
    expect(() => validateUrl('http://metadata.google.internal', mockLogger)).toThrow('Access to this hostname is not allowed');
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data', mockLogger)).toThrow('Access to private IP addresses is not allowed');
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
