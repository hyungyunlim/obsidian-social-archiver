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
	<!-- Minimal sticky header with future menu space -->
	<header class="page-header">
		<div class="header-content">
			<!-- Logo/Brand (future) -->
			<div class="header-left">
				<a href="/" class="brand-link" aria-label="Home">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
					</svg>
				</a>
			</div>

			<!-- User info - center -->
			<div class="header-center">
				<h1 class="username-title">@{data.username}</h1>
				<span class="post-count">
					{data.posts.length} {data.posts.length === 1 ? 'post' : 'posts'}
				</span>
			</div>

			<!-- Future menu space (login, explore, etc.) -->
			<div class="header-right">
				<!-- Placeholder for future features -->
			</div>
		</div>
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

	/* Minimal ultrathink-style header */
	.page-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background: var(--background-primary, #ffffff);
		border-bottom: 1px solid var(--background-modifier-border);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.75rem 1rem;
		height: 56px; /* Fixed minimal height */
	}

	/* Header sections */
	.header-left,
	.header-right {
		flex: 0 0 auto;
		min-width: 44px; /* Touch target size */
	}

	.header-center {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-width: 0; /* Allow shrinking */
	}

	/* Brand/Home link */
	.brand-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		color: var(--text-muted);
		transition: all 0.2s;
	}

	.brand-link:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	/* Username and post count */
	.username-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: -0.01em;
		color: var(--text-normal);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.post-count {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		padding: 2px 8px;
		background: var(--background-secondary);
		border-radius: 12px;
	}

	/* Main content */
	.main-content {
		max-width: 1200px;
		margin: 0 auto;
		padding-top: 0; /* Remove top padding since header is sticky */
	}

	/* Dark mode */
	@media (prefers-color-scheme: dark) {
		.page-container {
			background-color: var(--background-primary);
		}

		.page-header {
			background: rgba(10, 10, 10, 0.8); /* Semi-transparent for blur effect */
			border-bottom-color: var(--background-modifier-border);
		}

		.post-count {
			background: var(--background-secondary);
		}
	}

	/* Mobile - even more compact */
	@media (max-width: 640px) {
		.header-content {
			padding: 0.5rem 0.75rem;
			height: 48px; /* Smaller on mobile */
		}

		.username-title {
			font-size: 0.9375rem;
		}

		.post-count {
			font-size: 0.6875rem;
			padding: 1px 6px;
		}

		.brand-link {
			width: 28px;
			height: 28px;
		}

		.brand-link svg {
			width: 18px;
			height: 18px;
		}
	}

	/* Hover effects for future menu items */
	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
