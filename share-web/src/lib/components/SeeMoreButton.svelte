<script lang="ts">
	interface Props {
		expanded: boolean;
		onclick?: () => void;
	}

	let { expanded, onclick }: Props = $props();
</script>

<button
	type="button"
	class="see-more-btn"
	{onclick}
>
	{expanded ? 'See less' : 'See more'}
</button>

<style>
	.see-more-btn {
		font-size: 0.75rem;
		color: var(--text-muted, #6b7280);
		margin-top: 0.5rem;
		display: inline-block;
		text-align: left;
		padding: 0;
		background: transparent;
		border: none;
		outline: none;
		box-shadow: none;
		cursor: pointer;
		transition: color 0.2s;
		font-family: inherit;
	}

	.see-more-btn:hover {
		color: var(--interactive-accent, #3b82f6);
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.see-more-btn {
			color: #9ca3af;
		}
		.see-more-btn:hover {
			color: #60a5fa;
		}
	}
</style>