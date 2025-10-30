import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	renderMarkdown,
	extractTextFromMarkdown,
	generatePreview,
	renderMarkdownSync
} from './markdown';

describe('Markdown Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('renderMarkdown', () => {
		it('should render basic markdown to HTML', async () => {
			const markdown = '# Hello\n\nThis is **bold** text.';
			const html = await renderMarkdown(markdown);

			expect(html).toContain('<h1>Hello</h1>');
			expect(html).toContain('<strong>bold</strong>');
			expect(html).toContain('<p>');
		});

		it('should sanitize dangerous HTML', async () => {
			const dangerous = '# Title\n\n<script>alert("XSS")</script>\n\nSafe text';
			const html = await renderMarkdown(dangerous);

			expect(html).not.toContain('<script>');
			expect(html).not.toContain('alert');
			expect(html).toContain('Safe text');
		});

		it('should handle links with target="_blank"', async () => {
			const markdown = '[Example](https://example.com)';
			const html = await renderMarkdown(markdown);

			expect(html).toContain('target="_blank"');
			expect(html).toContain('rel="noopener noreferrer"');
			expect(html).toContain('href="https://example.com"');
		});

		it('should add lazy loading to images', async () => {
			const markdown = '![Alt text](https://example.com/image.jpg)';
			const html = await renderMarkdown(markdown);

			expect(html).toContain('loading="lazy"');
			expect(html).toContain('alt="Alt text"');
		});

		it('should respect maxLength option', async () => {
			const longMarkdown = 'This is a very long text that should be truncated at some point to respect the maximum length option provided to the function.';
			const html = await renderMarkdown(longMarkdown, { maxLength: 20 });

			expect(html).toContain('...');
			expect(html.length).toBeLessThan(longMarkdown.length * 2); // HTML adds tags
		});

		it('should handle allowImages option', async () => {
			const markdown = '![Image](https://example.com/img.jpg)\n\nText content';
			const htmlWithImages = await renderMarkdown(markdown, { allowImages: true });
			const htmlWithoutImages = await renderMarkdown(markdown, { allowImages: false });

			expect(htmlWithImages).toContain('<img');
			expect(htmlWithoutImages).not.toContain('<img');
			expect(htmlWithoutImages).toContain('Text content');
		});

		it('should handle code blocks', async () => {
			const markdown = '```javascript\nconst x = 42;\n```';
			const html = await renderMarkdown(markdown);

			expect(html).toContain('<pre>');
			expect(html).toContain('<code>');
			expect(html).toContain('const x = 42;');
		});
	});

	describe('extractTextFromMarkdown', () => {
		it('should extract plain text from markdown', () => {
			const markdown = '# Header\n\n**Bold** and *italic* text with [link](url).';
			const text = extractTextFromMarkdown(markdown);

			expect(text).toBe('Header Bold and italic text with link.');
			expect(text).not.toContain('#');
			expect(text).not.toContain('**');
			expect(text).not.toContain('[');
			expect(text).not.toContain('](');
		});

		it('should remove code blocks', () => {
			const markdown = 'Text before\n```js\ncode here\n```\nText after';
			const text = extractTextFromMarkdown(markdown);

			expect(text).toBe('Text before Text after');
			expect(text).not.toContain('```');
		});

		it('should handle lists', () => {
			const markdown = '- Item 1\n- Item 2\n1. Numbered\n2. List';
			const text = extractTextFromMarkdown(markdown);

			expect(text).toBe('Item 1 Item 2 Numbered List');
			expect(text).not.toContain('-');
			expect(text).not.toContain('1.');
		});

		it('should handle blockquotes', () => {
			const markdown = '> This is a quote\n> with multiple lines';
			const text = extractTextFromMarkdown(markdown);

			expect(text).toBe('This is a quote with multiple lines');
			expect(text).not.toContain('>');
		});

		it('should respect maxLength', () => {
			const markdown = 'This is a very long text that needs to be truncated';
			const text = extractTextFromMarkdown(markdown, 10);

			expect(text).toBe('This is a ...');
			expect(text.length).toBeLessThanOrEqual(14); // 10 chars + '...'
		});
	});

	describe('generatePreview', () => {
		it('should generate preview with default length', () => {
			const longText = 'a'.repeat(300);
			const preview = generatePreview(longText);

			expect(preview.length).toBeLessThanOrEqual(204); // 200 + '...'
			expect(preview).toContain('...');
		});

		it('should generate preview with custom length', () => {
			const text = 'This is a test text for preview generation.';
			const preview = generatePreview(text, 15);

			expect(preview).toBe('This is a test ...');
		});

		it('should not add ellipsis for short text', () => {
			const text = 'Short text';
			const preview = generatePreview(text);

			expect(preview).toBe('Short text');
			expect(preview).not.toContain('...');
		});
	});

	describe('renderMarkdownSync', () => {
		it('should escape HTML when libraries not loaded', () => {
			const markdown = '<script>alert("test")</script>\n**Bold**';
			const result = renderMarkdownSync(markdown);

			expect(result).toContain('&lt;script&gt;');
			expect(result).toContain('&lt;/script&gt;');
			expect(result).not.toContain('<script>');
			expect(result).toContain('<br>'); // Newline converted
		});

		it('should handle special characters', () => {
			const text = '& < > " \'';
			const result = renderMarkdownSync(text);

			expect(result).toBe('&amp; &lt; &gt; &quot; &#039;');
		});

		it('should convert newlines to breaks', () => {
			const text = 'Line 1\nLine 2\nLine 3';
			const result = renderMarkdownSync(text);

			expect(result).toBe('Line 1<br>Line 2<br>Line 3');
		});
	});
});