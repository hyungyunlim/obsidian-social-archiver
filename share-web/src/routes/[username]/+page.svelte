<script lang="ts">
	import type { PageData } from './$types';
	import Timeline from '$lib/components/Timeline.svelte';
	import { generateTimelineMetaTags } from '$lib/utils/seo';

	let { data }: { data: PageData } = $props();

	// Generate SEO meta tags
	const metaTags = $derived(generateTimelineMetaTags(data.username, data.posts.length));
</script>

<svelte:head>
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
	{/if}

	<!-- Twitter Card -->
	{#if metaTags.twitter}
		<meta name="twitter:card" content={metaTags.twitter.card} />
		<meta name="twitter:title" content={metaTags.twitter.title} />
		<meta name="twitter:description" content={metaTags.twitter.description} />
		{#if metaTags.twitter.site}
			<meta name="twitter:site" content={metaTags.twitter.site} />
		{/if}
	{/if}
</svelte:head>

<div class="page-container">
	<header class="page-header">
		<h1 class="username-title">@{data.username}</h1>
		<p class="post-count">
			{#if data.posts.length === 0}
				No posts shared yet
			{:else if data.posts.length === 1}
				1 post shared
			{:else}
				{data.posts.length} posts shared
			{/if}
		</p>
	</header>

	<main class="main-content">
		<Timeline
			posts={data.posts}
			emptyMessage="No posts have been shared yet."
			gridLayout="single"
			showShareButtons={false}
			username={data.username}
			enableNavigation={false}
		/>
	</main>
</div>

<style>
	.page-container {
		min-height: 100vh;
		background-color: var(--background-primary, #ffffff);
	}

	.page-header {
		padding: 1.5rem 1rem;
		background: var(--background-secondary, #f7f7f7);
		text-align: center;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.username-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		letter-spacing: -0.025em;
		color: var(--text-normal);
	}

	.post-count {
		font-size: 0.813rem;
		margin: 0;
		color: var(--text-muted);
	}

	.main-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.page-container {
			background-color: var(--background-primary);
		}

		.page-header {
			background: var(--background-secondary);
			border-bottom-color: var(--background-modifier-border);
		}
	}

	/* Mobile */
	@media (max-width: 640px) {
		.page-header {
			padding: 1.25rem 1rem;
		}

		.main-content {
			padding: 0 0.5rem;
		}

		.username-title {
			font-size: 1.25rem;
		}

		.post-count {
			font-size: 0.75rem;
		}
	}
</style>
