<script lang="ts">
	import type { PageData } from './$types';
	import PostCard from '$lib/components/PostCard.svelte';
	import { generatePostMetaTags, generatePostStructuredData } from '$lib/utils/seo';

	let { data }: { data: PageData } = $props();

	// Generate SEO meta tags and structured data
	const metaTags = $derived(data.post ? generatePostMetaTags(data.post, data.username) : null);
	const structuredData = $derived(data.post ? generatePostStructuredData(data.post, data.username) : null);
</script>

<svelte:head>
	{#if metaTags}
		<title>{metaTags.title}</title>
		<meta name="description" content={metaTags.description} />
		{#if metaTags.canonical}
			<link rel="canonical" href={metaTags.canonical} />
		{/if}

		<!-- Open Graph -->
		{#if metaTags.openGraph}
			<meta property="og:title" content={metaTags.openGraph.title} />
			<meta property="og:description" content={metaTags.openGraph.description} />
			<meta property="og:url" content={metaTags.openGraph.url} />
			<meta property="og:type" content={metaTags.openGraph.type} />
			<meta property="og:site_name" content={metaTags.openGraph.siteName} />
			{#if metaTags.openGraph.image}
				<meta property="og:image" content={metaTags.openGraph.image} />
			{/if}
		{/if}

		<!-- Twitter Card -->
		{#if metaTags.twitter}
			<meta name="twitter:card" content={metaTags.twitter.card} />
			<meta name="twitter:title" content={metaTags.twitter.title} />
			<meta name="twitter:description" content={metaTags.twitter.description} />
			{#if metaTags.twitter.image}
				<meta name="twitter:image" content={metaTags.twitter.image} />
			{/if}
			{#if metaTags.twitter.site}
				<meta name="twitter:site" content={metaTags.twitter.site} />
			{/if}
		{/if}
	{:else}
		<title>Post not found - Social Archiver</title>
		<meta name="description" content="The requested post could not be found" />
	{/if}

	<!-- Structured Data -->
	{#if structuredData}
		{@html `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`}
	{/if}
</svelte:head>

<div class="page-container">
	<div class="content-wrapper">
		<header class="breadcrumb">
			<a href="/share/{data.username}" class="back-link">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 18l-6-6 6-6" />
				</svg>
				Back to @{data.username}'s timeline
			</a>
		</header>

		<main>
			{#if data.post === null}
				<div class="empty-state">
					<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
						<circle cx="11" cy="11" r="8" />
						<path d="M21 21l-4.35-4.35" />
					</svg>
					<p>Post not found</p>
				</div>
			{:else}
				<PostCard post={data.post} showShareButton={false} />
			{/if}
		</main>
	</div>
</div>

<style>
	.page-container {
		min-height: 100vh;
		background-color: var(--background-primary, #ffffff);
		padding: 1rem;
	}

	.content-wrapper {
		max-width: 42rem;
		margin: 0 auto;
	}

	.breadcrumb {
		margin-bottom: 2rem;
		padding-bottom: 1rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-muted, #6b7280);
		text-decoration: none;
		font-size: 0.875rem;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: var(--interactive-accent, #3b82f6);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		padding: 2rem;
		border-radius: 0.5rem;
		background-color: var(--background-secondary, #f9fafb);
		color: var(--text-muted, #6b7280);
		text-align: center;
	}

	.empty-state svg {
		opacity: 0.3;
		margin-bottom: 1rem;
	}

	.empty-state p {
		font-size: 1rem;
		margin: 0;
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.page-container {
			background-color: #111827;
		}

		.empty-state {
			background-color: #1f2937;
			color: #9ca3af;
		}

		.back-link {
			color: #9ca3af;
		}

		.back-link:hover {
			color: #60a5fa;
		}
	}

	/* Mobile */
	@media (max-width: 640px) {
		.page-container {
			padding: 0.5rem;
		}

		.breadcrumb {
			margin-bottom: 1rem;
		}
	}
</style>
