import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { mediaProxyRouter } from '@/handlers/media-proxy-router';
import type { Bindings } from '@/types/bindings';

// Mock fetch globally
global.fetch = vi.fn();

describe('Media Proxy Handler', () => {
  let app: Hono;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/proxy-media', mediaProxyRouter);

    mockEnv = {
      KV_STORE: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      } as any,
    };

    vi.clearAllMocks();
  });

  describe('GET /api/proxy-media', () => {
    it('should return 400 when url parameter is missing', async () => {
      const req = new Request('http://localhost/api/proxy-media');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing url parameter');
    });

    it('should return 400 for invalid URL', async () => {
      const req = new Request('http://localhost/api/proxy-media?url=not-a-valid-url');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid URL');
    });

    it('should return 403 for unauthorized domain', async () => {
      const req = new Request('http://localhost/api/proxy-media?url=https://evil.com/image.jpg');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized domain');
    });

    it('should allow Instagram CDN domain', async () => {
      const mockResponse = new Response('fake-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': '12345',
        },
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://scontent.cdninstagram.com/v/t51.2885-15/123.jpg'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://scontent.cdninstagram.com/v/t51.2885-15/123.jpg',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            Accept: expect.stringContaining('image'),
          }),
        })
      );
    });

    it('should allow Reddit image domain (i.redd.it)', async () => {
      const mockResponse = new Response('fake-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': '12345',
        },
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://i.redd.it/i66x703pt5yf1.jpeg'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://i.redd.it/i66x703pt5yf1.jpeg',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            Referer: 'https://www.reddit.com/',
            Accept: expect.stringContaining('image'),
          }),
        })
      );
    });

    it('should allow Reddit video domain (v.redd.it)', async () => {
      const mockResponse = new Response('fake-video-data', {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': '123456',
        },
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://v.redd.it/abc123/DASH_720.mp4'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://v.redd.it/abc123/DASH_720.mp4',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            Referer: 'https://www.reddit.com/',
          }),
        })
      );
    });

    it('should allow Reddit preview domain', async () => {
      const mockResponse = new Response('fake-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '12345',
        },
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://preview.redd.it/xyz123.png'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://preview.redd.it/xyz123.png',
        expect.objectContaining({
          headers: expect.objectContaining({
            Referer: 'https://www.reddit.com/',
          }),
        })
      );
    });

    it('should allow TikTok domain with special headers', async () => {
      const mockResponse = new Response('fake-video-data', {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': '123456',
        },
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://v16-webapp-prime.tiktok.com/video/123.mp4'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://v16-webapp-prime.tiktok.com/video/123.mp4',
        expect.objectContaining({
          headers: expect.objectContaining({
            Referer: 'https://www.tiktok.com/',
            Origin: 'https://www.tiktok.com',
            Range: 'bytes=0-',
          }),
        })
      );
    });

    it('should return error when upstream fetch fails', async () => {
      const mockResponse = new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://i.redd.it/notfound.jpg'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('Failed to fetch media');
    });

    it('should include CORS headers in response', async () => {
      const mockResponse = new Response('fake-image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': '12345',
        },
      });
      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://i.redd.it/test.jpg'
      );
      const res = await app.request(req, mockEnv);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Cache-Control')).toContain('public');
    });

    it('should handle OPTIONS request for CORS preflight', async () => {
      const req = new Request('http://localhost/api/proxy-media', {
        method: 'OPTIONS',
      });
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should allow all supported platforms', async () => {
      const platforms = [
        { domain: 'cdninstagram.com', path: '/v/t51.2885-15/123.jpg' },
        { domain: 'scontent.fbcdn.net', path: '/v/t1.0-9/123.jpg' },
        { domain: 'pbs.twimg.com', path: '/media/abc.jpg' },
        { domain: 'media.licdn.com', path: '/dms/image/123.jpg' },
        { domain: 'static.threads.com', path: '/image/123.jpg' },
        { domain: 'i.ytimg.com', path: '/vi/abc/maxresdefault.jpg' },
        { domain: 'i.redd.it', path: '/test.jpg' },
        { domain: 'v.redd.it', path: '/abc/video.mp4' },
        { domain: 'preview.redd.it', path: '/test.png' },
        { domain: 'external-preview.redd.it', path: '/test.jpg' },
      ];

      for (const platform of platforms) {
        const mockResponse = new Response('data', {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        vi.mocked(global.fetch).mockResolvedValue(mockResponse);

        const url = `https://${platform.domain}${platform.path}`;
        const req = new Request(
          `http://localhost/api/proxy-media?url=${encodeURIComponent(url)}`
        );
        const res = await app.request(req, mockEnv);

        expect(res.status).toBe(200);
      }
    });

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const req = new Request(
        'http://localhost/api/proxy-media?url=https://i.redd.it/test.jpg'
      );
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
      expect(json.message).toContain('Network error');
    });
  });
});
