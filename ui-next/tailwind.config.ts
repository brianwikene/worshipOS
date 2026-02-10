import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			// 1. NEUTRALS: Your "Calm" Foundation
			colors: {
				gray: {
					25: '#f8f7f4', // Surface Muted
					50: '#f4f3f0', // UI BG
					100: '#eeece7', // Hover
					200: '#d8d5cf', // Border
					300: '#c3bfb8', // Border Strong
					400: '#a39f97',
					500: '#7f7b73',
					600: '#5f5b54', // Text Muted
					700: '#44413b',
					800: '#2e2b26',
					900: '#1f1c18', // Text Strong
					950: '#12100d'
				},
				// 2. THE BIOMES (Your Posture System)
				meadow: {
					50: '#f2f6f1', // Whisper Green (Legacy)
					100: '#e4ede1',
					200: '#ccd9c6',
					300: '#b1c2aa',
					400: '#8ea488',
					500: '#6f856a',
					600: '#596a55', // Legacy Families Accent (Grounded Green)
					700: '#465343',
					800: '#354034',
					900: '#2a3228',
					950: '#1a1f1a'
				},
				forest: {
					50: '#f1f4f2',
					100: '#e1e8e4',
					200: '#c4d1cb',
					300: '#a2b3a6',
					400: '#7e9283',
					500: '#65796a',
					600: '#4f5f53',
					700: '#3d4a41',
					800: '#2e3831', // Deep Pine
					900: '#242c27',
					950: '#171c19'
				},
				river: {
					50: '#f1f5f7', // Whisper Teal (Legacy)
					100: '#e3eaee',
					200: '#c7d3da',
					300: '#a7b6bf',
					400: '#869aa6',
					500: '#6b808c',
					600: '#546672', // Legacy Care Accent (Teal-ish)
					700: '#43535c',
					800: '#334047',
					900: '#273238',
					950: '#171e22'
				},
				hearth: {
					50: '#f7f1f1', // Whisper Rose (Legacy)
					100: '#f0e2e3',
					200: '#e0c7ca',
					300: '#caa8ad',
					400: '#b1878e',
					500: '#936a72',
					600: '#76545b', // Legacy Tend Accent
					700: '#5f4348',
					800: '#473236',
					900: '#362628',
					950: '#221618'
				},
				sky: {
					50: '#f2f4f8', // Whisper Blue (Legacy)
					100: '#e4e8f0',
					200: '#ccd5e2',
					300: '#b0bdd0',
					400: '#8e9fb8',
					500: '#7282a0',
					600: '#5b6884', // Legacy People Accent (Soft Blue)
					700: '#485369',
					800: '#364051',
					900: '#2a323f',
					950: '#1a1f28'
				}
			},
			borderRadius: {
				sm: '6px',
				md: '10px',
				lg: '16px',
				xl: '20px',
				'2xl': '24px'
			},
			boxShadow: {
				sm: '0 4px 10px rgba(15, 23, 42, 0.06)',
				md: '0 10px 20px rgba(15, 23, 42, 0.08)',
				lg: '0 25px 45px rgba(15, 23, 42, 0.12)'
			},
			fontFamily: {
				sans: [
					'Inter',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'Roboto',
					'Helvetica Neue',
					'Arial',
					'sans-serif'
				]
			}
		}
	},

	plugins: [typography, forms]
} satisfies Config;
