<script lang="ts">
	import { onMount } from 'svelte';

	// Redirect to a welcome page or show a landing page
	onMount(() => {
		// For now, just show a simple landing page
		// Later can redirect to a specific user or show featured content
	});
</script>

<svelte:head>
	<title>Social Archiver - Share Your Archived Posts</title>
	<meta name="description" content="View and share archived social media posts from various platforms" />
</svelte:head>

<div class="landing-container">
	<div class="hero">
		<h1 class="title">Social Archiver</h1>
		<p class="subtitle">Share and view archived social media posts</p>

		<div class="info-box">
			<p>Welcome to Social Archiver Share!</p>
			<p class="muted">To view someone's timeline, visit:</p>
			<code class="url-example">/[username]</code>
		</div>

		<div class="features">
			<div class="feature">
				<h3>📚 Archive</h3>
				<p>Save important social media posts</p>
			</div>
			<div class="feature">
				<h3>🔗 Share</h3>
				<p>Create shareable links for your archives</p>
			</div>
			<div class="feature">
				<h3>🔒 Privacy</h3>
				<p>Control who can see your content</p>
			</div>
		</div>
	</div>
</div>

<style>
	.landing-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: var(--background-primary);
		position: relative;
		overflow: hidden;
	}

	/* Subtle gradient overlay */
	.landing-container::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg,
			var(--interactive-accent) 0%,
			var(--interactive-accent-hover) 100%);
		opacity: 0.1;
		z-index: 0;
	}

	.hero {
		text-align: center;
		max-width: 600px;
		width: 100%;
		color: var(--text-normal);
		position: relative;
		z-index: 1;
	}

	.title {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.025em;
		background: linear-gradient(135deg,
			var(--interactive-accent) 0%,
			var(--interactive-accent-hover) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		font-size: 1.125rem;
		margin: 0 0 2rem 0;
		color: var(--text-muted);
	}

	.info-box {
		background: var(--background-secondary);
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin: 2rem 0;
		border: 1px solid var(--background-modifier-border);
	}

	.info-box p {
		margin: 0.5rem 0;
		color: var(--text-normal);
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.url-example {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 0.375rem;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.813rem;
		color: var(--interactive-accent);
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-top: 2.5rem;
	}

	.feature {
		padding: 1.25rem;
		background: var(--background-secondary);
		border-radius: 0.5rem;
		border: 1px solid var(--background-modifier-border);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.feature:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.feature h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: var(--text-normal);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.feature p {
		margin: 0;
		font-size: 0.813rem;
		color: var(--text-muted);
	}

	/* Dark mode specific adjustments */
	@media (prefers-color-scheme: dark) {
		.landing-container::before {
			opacity: 0.05;
		}

		.feature:hover {
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		}
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.landing-container {
			padding: 1rem;
		}

		.title {
			font-size: 2rem;
		}

		.subtitle {
			font-size: 1rem;
		}

		.features {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.feature {
			padding: 1rem;
		}
	}
</style>
