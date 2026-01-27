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
					25: '#f9fafc', // Surface Muted
					50: '#f6f7fb', // UI BG
					100: '#f3f4f6', // Hover
					200: '#e0e6f0', // Border
					300: '#d1d5db', // Border Strong
					400: '#9ca3af',
					500: '#6b7280',
					600: '#4b5563', // Text Muted
					700: '#374151',
					800: '#1f2937',
					900: '#111827', // Text Strong
					950: '#030712'
				},
				// 2. THE BIOMES (Your Posture System)
				meadow: {
					50: '#ecfdf0', // Whisper Green (Legacy)
					100: '#d1fae5',
					200: '#a7f3d0',
					300: '#6ee7b7',
					400: '#34d399',
					500: '#10b981',
					600: '#4f7c67', // Legacy Families Accent (Grounded Green)
					700: '#047857',
					800: '#065f46',
					900: '#064e3b',
					950: '#022c22'
				},
				forest: {
					50: '#f2f8f5',
					100: '#e6f4ea',
					200: '#ccebd6',
					300: '#99d6b3',
					400: '#5fb386',
					500: '#368f63',
					600: '#26704b',
					700: '#1e593d',
					800: '#1a4731', // Deep Pine
					900: '#143828',
					950: '#0a1f16'
				},
				river: {
					50: '#e0fbff', // Whisper Teal (Legacy)
					100: '#cbf6ff',
					200: '#a8edff',
					300: '#75e2ff',
					400: '#39d0fc',
					500: '#0ea5e9',
					600: '#0f766e', // Legacy Care Accent (Teal-ish)
					700: '#0e615a',
					800: '#115e59',
					900: '#134e4a',
					950: '#042f2e'
				},
				hearth: {
					50: '#fff1f2', // Whisper Rose (Legacy)
					100: '#ffe4e6',
					200: '#fecdd3',
					300: '#fda4af',
					400: '#fb7185',
					500: '#f43f5e',
					600: '#be123c', // Legacy Tend Accent
					700: '#9f1239',
					800: '#881337',
					900: '#71102f',
					950: '#4c0519'
				},
				sky: {
					50: '#eff6ff', // Whisper Blue (Legacy)
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#4a6fa5', // Legacy People Accent (Soft Blue)
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
					950: '#172554'
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
