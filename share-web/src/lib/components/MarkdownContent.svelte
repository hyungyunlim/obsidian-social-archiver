<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';

	interface Props {
		content: string;
		maxLength?: number;
		allowImages?: boolean;
		className?: string;
	}

	let { content, maxLength, allowImages = true, className = '' }: Props = $props();

	// Render markdown to HTML
	const html = $derived(renderMarkdown(content, { maxLength, allowImages }));
</script>

<!-- Use {@html} directive for rendered markdown -->
<div class="markdown-content {className}">
	{@html html}
</div>

<style>
	/* Markdown content styles */
	.markdown-content {
		color: var(--text-normal, currentColor);
		line-height: 1.75;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	/* Headings */
	.markdown-content :global(h1) {
		font-size: 2rem;
		font-weight: 700;
		margin: 1.5rem 0 1rem;
		line-height: 1.2;
	}

	.markdown-content :global(h2) {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 1.25rem 0 0.75rem;
		line-height: 1.3;
	}

	.markdown-content :global(h3) {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 1rem 0 0.5rem;
	}

	.markdown-content :global(h4),
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		font-size: 1rem;
		font-weight: 600;
		margin: 0.75rem 0 0.5rem;
	}

	/* Paragraphs and lists */
	.markdown-content :global(p) {
		margin: 0.75rem 0;
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: 0.75rem 0;
		padding-left: 1.5rem;
	}

	.markdown-content :global(li) {
		margin: 0.25rem 0;
	}

	/* Links */
	.markdown-content :global(a) {
		color: var(--interactive-accent, #3b82f6);
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.2s;
	}

	.markdown-content :global(a:hover) {
		color: var(--interactive-accent-hover, #2563eb);
	}

	/* Code */
	.markdown-content :global(code) {
		font-family: 'Courier New', monospace;
		font-size: 0.875em;
		padding: 0.125rem 0.25rem;
		background-color: var(--code-background, #f3f4f6);
		color: var(--code-text, #1f2937);
		border-radius: 0.25rem;
	}

	.markdown-content :global(pre) {
		margin: 1rem 0;
		padding: 1rem;
		background-color: var(--code-background, #f3f4f6);
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	.markdown-content :global(pre code) {
		padding: 0;
		background-color: transparent;
	}

	/* Blockquotes */
	.markdown-content :global(blockquote) {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		border-left: 4px solid var(--blockquote-border, #d1d5db);
		background-color: var(--blockquote-background, #f9fafb);
		color: var(--text-muted, #6b7280);
	}

	/* Images */
	.markdown-content :global(img) {
		max-width: 100%;
		height: auto;
		margin: 1rem 0;
		border-radius: 0.5rem;
	}

	/* Tables */
	.markdown-content :global(table) {
		width: 100%;
		margin: 1rem 0;
		border-collapse: collapse;
	}

	.markdown-content :global(th),
	.markdown-content :global(td) {
		padding: 0.5rem;
		border: 1px solid var(--table-border, #e5e7eb);
		text-align: left;
	}

	.markdown-content :global(th) {
		background-color: var(--table-header-background, #f9fafb);
		font-weight: 600;
	}

	/* Horizontal rules */
	.markdown-content :global(hr) {
		margin: 1.5rem 0;
		border: none;
		border-top: 1px solid var(--hr-color, #e5e7eb);
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.markdown-content {
			color: #f3f4f6;
		}

		.markdown-content :global(a) {
			color: #60a5fa;
		}

		.markdown-content :global(a:hover) {
			color: #93c5fd;
		}

		.markdown-content :global(code) {
			background-color: #374151;
			color: #f3f4f6;
		}

		.markdown-content :global(pre) {
			background-color: #1f2937;
		}

		.markdown-content :global(blockquote) {
			border-left-color: #4b5563;
			background-color: #1f2937;
			color: #9ca3af;
		}

		.markdown-content :global(th),
		.markdown-content :global(td) {
			border-color: #374151;
		}

		.markdown-content :global(th) {
			background-color: #1f2937;
		}

		.markdown-content :global(hr) {
			border-top-color: #374151;
		}
	}
</style>