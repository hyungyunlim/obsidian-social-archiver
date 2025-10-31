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
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.hero {
		text-align: center;
		max-width: 600px;
		width: 100%;
		color: white;
	}

	.title {
		font-size: 3rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		font-size: 1.25rem;
		opacity: 0.9;
		margin: 0 0 2rem 0;
	}

	.info-box {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-radius: 1rem;
		padding: 2rem;
		margin: 2rem 0;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.info-box p {
		margin: 0.5rem 0;
	}

	.muted {
		opacity: 0.8;
		font-size: 0.875rem;
	}

	.url-example {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 0.5rem;
		font-family: monospace;
		font-size: 0.875rem;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1.5rem;
		margin-top: 3rem;
	}

	.feature {
		padding: 1.5rem;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border-radius: 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.feature h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
	}

	.feature p {
		margin: 0;
		font-size: 0.875rem;
		opacity: 0.9;
	}

	@media (max-width: 640px) {
		.title {
			font-size: 2rem;
		}

		.features {
			grid-template-columns: 1fr;
		}
	}
</style>
