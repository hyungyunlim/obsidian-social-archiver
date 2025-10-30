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
		/>
	</main>
</div>

<style>
	.page-container {
		min-height: 100vh;
		background-color: var(--background-primary, #ffffff);
	}

	.page-header {
		padding: 2rem 1rem;
		background: linear-gradient(135deg, var(--interactive-accent, #3b82f6) 0%, #8b5cf6 100%);
		color: white;
		text-align: center;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.username-title {
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.025em;
	}

	.post-count {
		font-size: 0.875rem;
		opacity: 0.9;
		margin: 0;
	}

	.main-content {
		max-width: 1200px;
		margin: 0 auto;
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.page-container {
			background-color: #111827;
		}

		.page-header {
			background: linear-gradient(135deg, #1e40af 0%, #6b21a8 100%);
		}
	}

	/* Mobile */
	@media (max-width: 640px) {
		.page-header {
			padding: 1.5rem 1rem;
		}

		.username-title {
			font-size: 1.5rem;
		}
	}
</style>
