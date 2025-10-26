/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,svelte}',
    './src/**/*.{html,js}'
  ],
  // Disable preflight to prevent conflicts with Obsidian's native styles
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // Integrate Obsidian CSS variables for seamless theming
      colors: {
        // Background colors
        'obsidian-bg-primary': 'var(--background-primary)',
        'obsidian-bg-secondary': 'var(--background-secondary)',
        'obsidian-bg-modifier-border': 'var(--background-modifier-border)',
        'obsidian-bg-modifier-hover': 'var(--background-modifier-hover)',

        // Text colors
        'obsidian-text': 'var(--text-normal)',
        'obsidian-text-muted': 'var(--text-muted)',
        'obsidian-text-faint': 'var(--text-faint)',
        'obsidian-text-accent': 'var(--text-accent)',
        'obsidian-text-accent-hover': 'var(--text-accent-hover)',

        // Interactive elements
        'obsidian-interactive': 'var(--interactive-normal)',
        'obsidian-interactive-hover': 'var(--interactive-hover)',
        'obsidian-interactive-accent': 'var(--interactive-accent)',
        'obsidian-interactive-accent-hover': 'var(--interactive-accent-hover)',

        // Status colors
        'obsidian-error': 'var(--text-error)',
        'obsidian-warning': 'var(--text-warning)',
        'obsidian-success': 'var(--text-success)',
      },

      // Mobile-first responsive breakpoints
      screens: {
        'xs': '375px',  // iPhone SE, small phones
        'sm': '640px',  // Large phones
        'md': '768px',  // Tablets
        'lg': '1024px', // Desktop
        'xl': '1280px', // Large desktop
      },

      // Mobile touch target utilities (iOS HIG: 44px minimum)
      spacing: {
        'touch-min': '44px', // Minimum touch target size
      },

      // Custom utilities for Obsidian-specific layouts
      minHeight: {
        'touch-target': '44px',
      },
      minWidth: {
        'touch-target': '44px',
      },
    },
  },
  plugins: [
    // Custom utilities for mobile-first design
    function({ addUtilities }) {
      const mobileUtilities = {
        // Touch target utilities (iOS HIG: 44px minimum)
        '.touch-target': {
          minWidth: '44px',
          minHeight: '44px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },

        // iOS safe area utilities
        '.safe-area-inset-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.safe-area-inset-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-area-inset-left': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.safe-area-inset-right': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.safe-area-inset': {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        },

        // Mobile modal utilities optimized for Obsidian
        '.mobile-modal': {
          maxHeight: 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        },

        // Mobile dropdown utilities
        '.mobile-dropdown': {
          maxHeight: '60vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        },

        // Prevent text selection (useful for buttons)
        '.no-select': {
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none', // Disable callout on iOS
        },

        // Active state for touch (visual feedback)
        '.touch-active': {
          transition: 'opacity 0.1s ease',
          '&:active': {
            opacity: '0.7',
          },
        },
      };

      addUtilities(mobileUtilities);
    },
  ],
}
