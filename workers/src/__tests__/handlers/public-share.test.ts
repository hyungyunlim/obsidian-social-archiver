import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { publicShareRouter } from '@/handlers/public-share';
import type { ShareInfo } from '@/services/ShareService';

describe('Public Share Handler', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/share', publicShareRouter);
  });

  describe('GET /share/:id', () => {
    const mockShareInfo: ShareInfo = {
      id: 'test123',
      noteId: 'note.md',
      notePath: 'note.md',
      content: '# Test Note\n\nThis is a test.',
      metadata: {
        title: 'Test Note',
        author: 'Test Author',
        tags: ['#test', '#example'],
        created: 1609459200000,
        modified: 1609545600000
      },
      viewCount: 5,
      tier: 'free',
      createdAt: new Date('2024-01-01'),
      expiresAt: new Date('2025-12-31')
    };

    it('should return 404 for non-existent share', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(null)
        },
        R2_BUCKET: {
          get: vi.fn().mockResolvedValue(null)
        }
      };

      const req = new Request('http://localhost/share/nonexistent');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(404);
      const html = await res.text();
      expect(html).toContain('404');
      expect(html).toContain('Share link not found');
    });

    it('should return 410 for expired share', async () => {
      const expiredShare: ShareInfo = {
        ...mockShareInfo,
        expiresAt: new Date('2020-01-01')
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(expiredShare)
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(410);
      const html = await res.text();
      expect(html).toContain('Link Expired');
    });

    it('should return 401 for password-protected share without password', async () => {
      const protectedShare: ShareInfo = {
        ...mockShareInfo,
        password: 'hashed_password'
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(protectedShare)
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
      const html = await res.text();
      expect(html).toContain('Password Required');
    });

    it('should return 429 for rate-limited IP', async () => {
      const protectedShare: ShareInfo = {
        ...mockShareInfo,
        password: 'hashed_password'
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn()
            .mockResolvedValueOnce(protectedShare)
            .mockResolvedValueOnce({
              attempts: 5,
              firstAttempt: Date.now()
            })
        }
      };

      const req = new Request('http://localhost/share/test123?password=wrong');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(429);
      const html = await res.text();
      expect(html).toContain('Too Many Attempts');
    });

    it('should render share page with content', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      const html = await res.text();

      // Check HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Test Note');
      expect(html).toContain('Test Author');
      expect(html).toContain('<h1>Test Note</h1>');
      expect(html).toContain('This is a test');
    });

    it('should include security headers', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      expect(res.headers.get('Content-Security-Policy')).toContain('default-src');
    });

    it('should increment view count', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      await app.request(req, mockEnv);

      // Verify view count was updated
      expect(mockEnv.SHARE_LINKS.put).toHaveBeenCalled();
      const putCall = vi.mocked(mockEnv.SHARE_LINKS.put).mock.calls[0];
      const savedData = JSON.parse(putCall[1] as string);
      expect(savedData.viewCount).toBe(6); // Original was 5
    });

    it('should render table of contents for long notes', async () => {
      const noteWithHeadings: ShareInfo = {
        ...mockShareInfo,
        content: `# Main Title

## Section 1

Content here.

## Section 2

More content.

### Subsection 2.1

Details.`
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(noteWithHeadings),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('Table of Contents');
      expect(html).toContain('Main Title');
      expect(html).toContain('Section 1');
      expect(html).toContain('Section 2');
      expect(html).toContain('Subsection 2.1');
    });

    it('should display tags if present', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('#test');
      expect(html).toContain('#example');
    });

    it('should show view count', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('5 views');
    });

    it('should include disclaimer', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('archived from social media');
      expect(html).toContain('original author');
    });

    it('should render markdown correctly', async () => {
      const noteWithMarkdown: ShareInfo = {
        ...mockShareInfo,
        content: `# Heading

**Bold text** and *italic text*

- List item 1
- List item 2

\`\`\`javascript
const code = 'example';
\`\`\`

[Link](https://example.com)`
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(noteWithMarkdown),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('<strong>Bold text</strong>');
      expect(html).toContain('<em>italic text</em>');
      expect(html).toContain('<li>List item 1</li>');
      expect(html).toContain('<code');
      expect(html).toContain('<a href="https://example.com"');
    });

    it('should handle notes without author', async () => {
      const noteWithoutAuthor: ShareInfo = {
        ...mockShareInfo,
        metadata: {
          ...mockShareInfo.metadata,
          author: undefined
        }
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(noteWithoutAuthor),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain('By ');
    });

    it('should handle notes without tags', async () => {
      const noteWithoutTags: ShareInfo = {
        ...mockShareInfo,
        metadata: {
          ...mockShareInfo.metadata,
          tags: []
        }
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(noteWithoutTags),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).not.toContain('class="tags"');
    });

    it('should be mobile responsive', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('viewport');
      expect(html).toContain('@media (max-width: 768px)');
    });

    it('should include syntax highlighting', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('prism');
    });

    it('should include copy buttons for code blocks', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(mockShareInfo),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('copy-button');
      expect(html).toContain('navigator.clipboard');
    });

    it('should handle server errors gracefully', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockRejectedValue(new Error('Database error'))
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(500);
      const html = await res.text();
      expect(html).toContain('Something Went Wrong');
    });
  });

  describe('generateTableOfContents', () => {
    // This function is not exported, so we test it through the handler
    it('should generate TOC from markdown headings', async () => {
      const markdown = `# Main Heading

## Section 1

### Subsection 1.1

## Section 2`;

      const shareWithHeadings: ShareInfo = {
        id: 'test123',
        noteId: 'note.md',
        notePath: 'note.md',
        content: markdown,
        metadata: {
          title: 'Test',
          created: Date.now(),
          modified: Date.now()
        },
        viewCount: 0,
        tier: 'free',
        createdAt: new Date()
      };

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue(shareWithHeadings),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('toc-1');
      expect(html).toContain('toc-2');
      expect(html).toContain('toc-3');
    });
  });

  describe('security', () => {
    it('should prevent search engine indexing', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue({
            id: 'test123',
            noteId: 'note.md',
            notePath: 'note.md',
            content: '# Test',
            metadata: { title: 'Test', created: Date.now(), modified: Date.now() },
            viewCount: 0,
            tier: 'free',
            createdAt: new Date()
          }),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();
      expect(html).toContain('noindex');
      expect(html).toContain('nofollow');
      expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    });

    it('should have proper CSP headers', async () => {
      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue({
            id: 'test123',
            noteId: 'note.md',
            notePath: 'note.md',
            content: '# Test',
            metadata: { title: 'Test', created: Date.now(), modified: Date.now() },
            viewCount: 0,
            tier: 'free',
            createdAt: new Date()
          }),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'unsafe-inline'");
    });

    it('should sanitize HTML content', async () => {
      const maliciousContent = `# Test

<script>alert('XSS')</script>

<img src="x" onerror="alert('XSS')">`;

      const mockEnv = {
        SHARE_LINKS: {
          get: vi.fn().mockResolvedValue({
            id: 'test123',
            noteId: 'note.md',
            notePath: 'note.md',
            content: maliciousContent,
            metadata: { title: 'Test', created: Date.now(), modified: Date.now() },
            viewCount: 0,
            tier: 'free',
            createdAt: new Date()
          }),
          put: vi.fn()
        }
      };

      const req = new Request('http://localhost/share/test123');
      const res = await app.request(req, mockEnv);

      const html = await res.text();

      // Marked.js should safely escape or remove potentially harmful content
      // The exact behavior depends on marked's configuration, but generally:
      // - Scripts should be escaped or removed
      // - Event handlers should be removed
      expect(html).not.toContain('onerror=');
    });
  });
});
