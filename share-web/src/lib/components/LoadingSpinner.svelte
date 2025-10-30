<script lang="ts">
	interface Props {
		size?: 'small' | 'medium' | 'large';
		message?: string;
	}

	let { size = 'medium', message }: Props = $props();

	const sizeClasses = {
		small: 'w-6 h-6',
		medium: 'w-10 h-10',
		large: 'w-16 h-16'
	};
</script>

<div class="loading-container">
	<svg
		class="loading-spinner {sizeClasses[size]}"
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<circle
			class="opacity-25"
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			stroke-width="4"
		/>
		<path
			class="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
		/>
	</svg>
	{#if message}
		<p class="loading-message">{message}</p>
	{/if}
</div>

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
		min-height: 200px;
	}

	.loading-spinner {
		animation: spin 1s linear infinite;
		color: var(--text-accent, #4a9eff);
	}

	.loading-message {
		color: var(--text-muted, #666);
		font-size: 0.875rem;
		margin: 0;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>