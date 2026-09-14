import tailwindAnimate from 'tailwindcss-animate';
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,jsx,ts,tsx}",
		"./components/**/*.{js,jsx,ts,tsx}",
		"./app/**/*.{js,jsx,ts,tsx}",
		"./src/**/*.{js,jsx,ts,tsx}",
		"./index.html",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				// Apple semantic layer (light/dark values resolved via CSS vars in
				// src/app.css). Primitives migrate onto these; existing pages keep
				// using the shadcn tokens above until each portal is converted.
				label: {
					DEFAULT: 'var(--label)',
					2: 'var(--label-2)',
					3: 'var(--label-3)'
				},
				surface: {
					1: 'var(--surface-1)',
					2: 'var(--surface-2)'
				},
				separator: {
					DEFAULT: 'var(--separator)',
					strong: 'var(--separator-strong)'
				},
				fill: {
					DEFAULT: 'var(--fill)',
					2: 'var(--fill-2)'
				},
				brand: {
					DEFAULT: 'var(--brand)',
					press: 'var(--brand-press)',
					text: 'var(--brand-text)',
					on: 'var(--on-brand)'
				},
				sys: {
					red: 'var(--sys-red)',
					green: 'var(--sys-green)',
					orange: 'var(--sys-orange)',
					blue: 'var(--sys-blue)'
				},
				chrome: 'var(--chrome)',
				ivory: {
					DEFAULT: '#ffffff',
					cream: '#faf9f7',
					warm: '#f8f6f0'
				},
				floral: {
					rose: '#d4a574',
					sage: '#9caf88',
					lavender: '#b8a9d1',
					terracotta: '#c67c4e'
				}
			},
			fontFamily: {
				// SF Pro on Apple (via -apple-system) → Inter on web/Android.
				sans: ['-apple-system', 'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
				serif: ['-apple-system', 'Inter', 'system-ui', 'sans-serif'],
				mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
				display: ['-apple-system', 'Inter', 'system-ui', 'sans-serif'],
				body: ['-apple-system', 'Inter', 'system-ui', 'sans-serif']
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				// Apple continuous-corner scale (retires the ad-hoc 40px radii).
				control: 'var(--r-control)',
				card: 'var(--r-card)',
				sheet: 'var(--r-sheet)'
			},
			transitionTimingFunction: {
				ios: 'var(--ease-ios)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'slow-zoom': {
					'0%': { transform: 'scale(1.05)' },
					'100%': { transform: 'scale(1.15)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'slow-zoom': 'slow-zoom 20s linear infinite alternate',
			},
		},
	},
	plugins: [tailwindAnimate],
} satisfies Config;
