/**
 * Markdown utilities for rendering post content
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Configure marked options
 */
marked.setOptions({
	breaks: true, // Convert line breaks to <br>
	gfm: true, // GitHub Flavored Markdown
});

/**
 * Custom renderer for links to open in new tab
 */
const renderer = new marked.Renderer();
renderer.link = (href: string | null, title: string | null, text: string) => {
	const titleAttr = title ? `title="${title}"` : '';
	return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${titleAttr}>${text}</a>`;
};

/**
 * Custom renderer for images with lazy loading
 */
renderer.image = (src: string | null, title: string | null, alt: string) => {
	const titleAttr = title ? `title="${title}"` : '';
	return `<img src="${src}" alt="${alt}" ${titleAttr} loading="lazy" />`;
};

marked.use({ renderer });

/**
 * Render markdown to safe HTML
 *
 * @param markdown - Markdown content to render
 * @param options - Rendering options
 * @returns Sanitized HTML string
 */
export function renderMarkdown(
	markdown: string,
	options: { allowImages?: boolean; maxLength?: number } = {}
): string {
	const { allowImages = true, maxLength } = options;

	// Truncate if needed
	let content = markdown;
	if (maxLength && markdown.length > maxLength) {
		content = markdown.substring(0, maxLength) + '...';
	}

	// Parse markdown to HTML (marked.parse returns a string synchronously in v11+)
	const html = marked.parse(content) as string;

	// Configure DOMPurify
	const purifyConfig = {
		ADD_ATTR: ['target', 'rel', 'loading'],
		ALLOWED_TAGS: [
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'blockquote', 'p', 'a', 'ul', 'ol', 'li',
			'b', 'i', 'strong', 'em', 'strike', 'code', 'pre',
			'hr', 'br', 'div', 'span', 'table', 'thead', 'tbody',
			'tr', 'th', 'td', 'caption',
			...(allowImages ? ['img', 'figure', 'figcaption'] : [])
		],
		ALLOWED_ATTR: [
			'href', 'title', 'target', 'rel',
			'class', 'id',
			...(allowImages ? ['src', 'alt', 'width', 'height', 'loading'] : [])
		]
	};

	// Sanitize HTML
	return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * Extract plain text from markdown
 *
 * @param markdown - Markdown content
 * @param maxLength - Maximum length of extracted text
 * @returns Plain text string
 */
export function extractTextFromMarkdown(markdown: string, maxLength?: number): string {
	// Remove markdown syntax
	let text = markdown
		// Headers
		.replace(/^#{1,6}\s+/gm, '')
		// Bold/Italic
		.replace(/(\*\*|__)(.*?)\1/g, '$2')
		.replace(/(\*|_)(.*?)\1/g, '$2')
		// Links
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		// Images
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
		// Code blocks
		.replace(/```[^`]*```/g, '')
		.replace(/`([^`]+)`/g, '$1')
		// Blockquotes
		.replace(/^>\s+/gm, '')
		// Lists
		.replace(/^[\s]*[-*+]\s+/gm, '')
		.replace(/^[\s]*\d+\.\s+/gm, '')
		// Horizontal rules
		.replace(/^-{3,}$/gm, '')
		// Multiple spaces/newlines
		.replace(/\s+/g, ' ')
		.trim();

	// Truncate if needed
	if (maxLength && text.length > maxLength) {
		text = text.substring(0, maxLength) + '...';
	}

	return text;
}

/**
 * Generate preview text from markdown
 *
 * @param markdown - Markdown content
 * @param length - Preview length (default: 200)
 * @returns Preview text
 */
export function generatePreview(markdown: string, length: number = 200): string {
	return extractTextFromMarkdown(markdown, length);
}