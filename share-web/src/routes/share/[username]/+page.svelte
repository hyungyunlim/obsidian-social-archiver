<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.username}'s Timeline - Social Archiver</title>
	<meta name="description" content="View {data.username}'s shared posts on Social Archiver" />
</svelte:head>

<div class="min-h-screen bg-bg-primary p-4">
	<div class="mx-auto max-w-2xl">
		<header class="mb-8">
			<h1 class="text-3xl font-bold text-text-normal">{data.username}'s Timeline</h1>
			<p class="text-text-muted mt-2">Shared posts from Social Archiver</p>
		</header>

		{#if data.posts.length === 0}
			<div class="post-card text-center py-12">
				<p class="text-text-muted text-lg">No posts shared yet</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each data.posts as post}
					<div class="post-card">
						<p class="text-text-normal">{post.title}</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
