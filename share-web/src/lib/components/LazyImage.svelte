<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		src: string;
		alt: string;
		class?: string;
		width?: number;
		height?: number;
		loading?: 'lazy' | 'eager';
		placeholder?: string;
	}

	let {
		src,
		alt,
		class: className = '',
		width,
		height,
		loading = 'lazy',
		placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23e5e5e5"/%3E%3C/svg%3E'
	}: Props = $props();

	let imgElement: HTMLImageElement;
	let isLoaded = $state(false);
	let isInView = $state(false);
	let hasError = $state(false);

	onMount(() => {
		if (loading === 'eager' || !('IntersectionObserver' in window)) {
			// Load immediately if eager or no IntersectionObserver support
			isInView = true;
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !isInView) {
						isInView = true;
						observer.unobserve(imgElement);
					}
				});
			},
			{
				// Start loading when image is 50px away from viewport
				rootMargin: '50px'
			}
		);

		if (imgElement) {
			observer.observe(imgElement);
		}

		return () => {
			if (imgElement) {
				observer.unobserve(imgElement);
			}
		};
	});

	function handleLoad() {
		isLoaded = true;
		hasError = false;
	}

	function handleError() {
		hasError = true;
		isLoaded = false;
	}
</script>

<div class="lazy-image-wrapper {className}">
	{#if !isLoaded && !hasError}
		<img
			src={placeholder}
			alt={alt}
			{width}
			{height}
			class="lazy-image-placeholder"
			aria-hidden="true"
		/>
	{/if}

	<img
		bind:this={imgElement}
		src={isInView ? src : placeholder}
		{alt}
		{width}
		{height}
		class="lazy-image {isLoaded ? 'loaded' : ''} {hasError ? 'error' : ''}"
		onload={handleLoad}
		onerror={handleError}
		loading={loading}
	/>

	{#if hasError}
		<div class="lazy-image-error">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
				<circle cx="8.5" cy="8.5" r="1.5"/>
				<polyline points="21 15 16 10 5 21"/>
			</svg>
			<span>Failed to load image</span>
		</div>
	{/if}
</div>

<style>
	.lazy-image-wrapper {
		position: relative;
		overflow: hidden;
		background: var(--bg-secondary, #f3f3f3);
	}

	.lazy-image-placeholder {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		filter: blur(10px);
		transform: scale(1.1);
	}

	.lazy-image {
		display: block;
		width: 100%;
		height: auto;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.lazy-image.loaded {
		opacity: 1;
	}

	.lazy-image.error {
		display: none;
	}

	.lazy-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		color: var(--text-muted, #666);
		gap: 0.5rem;
		min-height: 200px;
	}

	.lazy-image-error svg {
		opacity: 0.5;
	}

	.lazy-image-error span {
		font-size: 0.875rem;
		opacity: 0.7;
	}
</style>