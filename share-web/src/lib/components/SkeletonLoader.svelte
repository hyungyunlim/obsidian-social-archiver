<script lang="ts">
	interface Props {
		type?: 'text' | 'card' | 'image' | 'avatar';
		count?: number;
		class?: string;
	}

	let { type = 'text', count = 1, class: className = '' }: Props = $props();
</script>

<div class="skeleton-container {className}">
	{#each Array(count) as _}
		<div class="skeleton skeleton-{type}" aria-hidden="true">
			{#if type === 'card'}
				<div class="skeleton-card">
					<div class="skeleton-header">
						<div class="skeleton-avatar" />
						<div class="skeleton-meta">
							<div class="skeleton-line short" />
							<div class="skeleton-line shorter" />
						</div>
					</div>
					<div class="skeleton-content">
						<div class="skeleton-line" />
						<div class="skeleton-line" />
						<div class="skeleton-line short" />
					</div>
				</div>
			{:else if type === 'image'}
				<div class="skeleton-image" />
			{:else if type === 'avatar'}
				<div class="skeleton-avatar" />
			{:else}
				<div class="skeleton-line" />
			{/if}
		</div>
	{/each}
</div>

<style>
	.skeleton-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.skeleton {
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-line {
		height: 1rem;
		background: var(--bg-secondary, #e5e5e5);
		border-radius: 0.25rem;
		width: 100%;
		margin-bottom: 0.5rem;
	}

	.skeleton-line.short {
		width: 75%;
	}

	.skeleton-line.shorter {
		width: 50%;
	}

	.skeleton-card {
		background: var(--bg-primary, white);
		border: 1px solid var(--border-primary, #e5e5e5);
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.skeleton-header {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.skeleton-avatar {
		width: 3rem;
		height: 3rem;
		background: var(--bg-secondary, #e5e5e5);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.skeleton-meta {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.25rem;
	}

	.skeleton-meta .skeleton-line {
		margin-bottom: 0;
		height: 0.75rem;
	}

	.skeleton-content {
		margin-left: 4rem;
	}

	.skeleton-image {
		width: 100%;
		height: 200px;
		background: var(--bg-secondary, #e5e5e5);
		border-radius: 0.5rem;
	}

	@keyframes pulse {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.skeleton-line,
		.skeleton-avatar,
		.skeleton-image {
			background: rgba(255, 255, 255, 0.1);
		}

		.skeleton-card {
			background: var(--bg-primary, #1a1a1a);
			border-color: rgba(255, 255, 255, 0.1);
		}
	}
</style>