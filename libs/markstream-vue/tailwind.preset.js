/**
 * Shared Tailwind preset for markstream-vue.
 *
 * Maps Tailwind utilities to --ms-* design tokens so that rounded-*,
 * font-*, and color utilities respond to theme switching.
 *
 * Usage (consumer):
 *   import markstreamPreset from 'markstream-vue/tailwind.preset'
 *   export default { presets: [markstreamPreset], ... }
 */

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        'background': 'hsl(var(--ms-background))',
        'foreground': 'hsl(var(--ms-foreground))',
        'muted': 'hsl(var(--ms-muted))',
        'muted-foreground': 'hsl(var(--ms-muted-foreground))',
        'secondary': 'hsl(var(--ms-secondary))',
        'secondary-foreground': 'hsl(var(--ms-secondary-foreground))',
        'accent': 'hsl(var(--ms-accent))',
        'accent-foreground': 'hsl(var(--ms-accent-foreground))',
        'primary': 'hsl(var(--ms-primary))',
        'primary-foreground': 'hsl(var(--ms-primary-foreground))',
        'destructive': 'hsl(var(--ms-destructive))',
        'destructive-foreground': 'hsl(var(--ms-destructive-foreground))',
        'border': 'hsl(var(--ms-border))',
        'ring': 'hsl(var(--ms-ring))',
        'popover': 'hsl(var(--ms-popover))',
        'popover-foreground': 'hsl(var(--ms-popover-foreground))',
      },
      borderRadius: {
        lg: 'var(--ms-radius)',
        md: 'calc(var(--ms-radius) * 0.75)',
        DEFAULT: 'calc(var(--ms-radius) * 0.5)',
        sm: 'calc(var(--ms-radius) * 0.33)',
      },
      fontFamily: {
        sans: ['var(--ms-font-sans)'],
        mono: ['var(--ms-font-mono)'],
      },
    },
  },
}
