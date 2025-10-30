/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
	const announcement = document.createElement('div');
	announcement.setAttribute('aria-live', priority);
	announcement.setAttribute('aria-atomic', 'true');
	announcement.setAttribute('class', 'sr-only');
	announcement.textContent = message;

	document.body.appendChild(announcement);

	// Remove after announcement
	setTimeout(() => {
		document.body.removeChild(announcement);
	}, 1000);
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Trap focus within an element (for modals, dialogs)
 */
export function trapFocus(element: HTMLElement) {
	const focusableElements = element.querySelectorAll<HTMLElement>(
		'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
	);
	const firstFocusable = focusableElements[0];
	const lastFocusable = focusableElements[focusableElements.length - 1];

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		if (e.shiftKey) {
			// Shift + Tab
			if (document.activeElement === firstFocusable) {
				lastFocusable.focus();
				e.preventDefault();
			}
		} else {
			// Tab
			if (document.activeElement === lastFocusable) {
				firstFocusable.focus();
				e.preventDefault();
			}
		}
	}

	element.addEventListener('keydown', handleKeydown);

	// Focus first element
	firstFocusable?.focus();

	return () => {
		element.removeEventListener('keydown', handleKeydown);
	};
}

/**
 * Generate unique ID for ARIA relationships
 */
export function generateId(prefix: string = 'aria'): string {
	return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check color contrast ratio for WCAG compliance
 */
export function getContrastRatio(color1: string, color2: string): number {
	// Convert hex to RGB
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	if (!rgb1 || !rgb2) return 0;

	// Calculate relative luminance
	const lum1 = getRelativeLuminance(rgb1);
	const lum2 = getRelativeLuminance(rgb2);

	// Calculate contrast ratio
	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);

	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standards
 */
export function meetsWCAGAA(ratio: number, largeText: boolean = false): boolean {
	// WCAG AA requires 4.5:1 for normal text, 3:1 for large text
	return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standards
 */
export function meetsWCAGAAA(ratio: number, largeText: boolean = false): boolean {
	// WCAG AAA requires 7:1 for normal text, 4.5:1 for large text
	return largeText ? ratio >= 4.5 : ratio >= 7;
}

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16)
			}
		: null;
}

function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
	const { r, g, b } = rgb;

	// Convert RGB to sRGB
	const rsRGB = r / 255;
	const gsRGB = g / 255;
	const bsRGB = b / 255;

	// Apply gamma correction
	const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
	const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
	const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

	// Calculate luminance
	return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Keyboard navigation helper
 */
export class KeyboardNavigator {
	private items: HTMLElement[];
	private currentIndex: number = 0;

	constructor(items: HTMLElement[] | NodeListOf<HTMLElement>) {
		this.items = Array.from(items);
	}

	handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowUp':
			case 'ArrowLeft':
				event.preventDefault();
				this.focusPrevious();
				break;
			case 'ArrowDown':
			case 'ArrowRight':
				event.preventDefault();
				this.focusNext();
				break;
			case 'Home':
				event.preventDefault();
				this.focusFirst();
				break;
			case 'End':
				event.preventDefault();
				this.focusLast();
				break;
		}
	}

	focusNext() {
		this.currentIndex = (this.currentIndex + 1) % this.items.length;
		this.items[this.currentIndex].focus();
	}

	focusPrevious() {
		this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
		this.items[this.currentIndex].focus();
	}

	focusFirst() {
		this.currentIndex = 0;
		this.items[0].focus();
	}

	focusLast() {
		this.currentIndex = this.items.length - 1;
		this.items[this.currentIndex].focus();
	}

	setFocusToItem(index: number) {
		if (index >= 0 && index < this.items.length) {
			this.currentIndex = index;
			this.items[index].focus();
		}
	}
}

/**
 * Skip to main content link helper
 */
export function createSkipLink(targetId: string = 'main-content'): HTMLAnchorElement {
	const skipLink = document.createElement('a');
	skipLink.href = `#${targetId}`;
	skipLink.className = 'skip-to-main';
	skipLink.textContent = 'Skip to main content';
	skipLink.setAttribute('aria-label', 'Skip to main content');

	// Style for visibility only on focus
	const style = document.createElement('style');
	style.textContent = `
		.skip-to-main {
			position: absolute;
			top: -40px;
			left: 0;
			background: var(--text-accent, #000);
			color: var(--bg-primary, #fff);
			padding: 8px;
			text-decoration: none;
			z-index: 100000;
			border-radius: 0 0 4px 0;
		}
		.skip-to-main:focus {
			top: 0;
		}
	`;

	if (!document.head.querySelector('style[data-skip-link]')) {
		style.setAttribute('data-skip-link', 'true');
		document.head.appendChild(style);
	}

	return skipLink;
}