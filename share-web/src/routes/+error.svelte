<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Error - Social Archiver</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary flex items-center justify-center p-4">
	<div class="text-center">
		<h1 class="text-6xl font-bold text-text-normal mb-4">{$page.status}</h1>
		<p class="text-2xl text-text-muted mb-8">{$page.error?.message || 'An error occurred'}</p>
		<a
			href="/"
			class="inline-block px-6 py-3 bg-text-accent hover:bg-text-normal text-bg-primary rounded-lg transition-smooth"
		>
			Go Home
		</a>
	</div>
</div>
