<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Post by {data.username} - Social Archiver</title>
	<meta name="description" content="View this post shared on Social Archiver" />
</svelte:head>

<div class="min-h-screen bg-bg-primary p-4">
	<div class="mx-auto max-w-2xl">
		<header class="mb-8">
			<a
				href="/share/{data.username}"
				class="text-text-accent hover:text-text-normal transition-smooth"
			>
				← Back to {data.username}'s timeline
			</a>
		</header>

		{#if data.post === null}
			<div class="post-card text-center py-12">
				<p class="text-text-muted text-lg">Post not found</p>
			</div>
		{:else}
			<article class="post-card">
				<h1 class="text-2xl font-bold text-text-normal mb-4">{data.post.title}</h1>
				<div class="text-text-normal prose prose-invert max-w-none">
					{data.post.content}
				</div>
			</article>
		{/if}
	</div>
</div>
