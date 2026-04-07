import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'shop-sm': ['14px', '20px'],
        'shop-base': ['16px', '24px'],
        'shop-lg': ['18px', '28px'],
        'shop-xl': ['20px', '30px'],
        'shop-2xl': ['24px', '32px'],
      },
      spacing: {
        'touch-min': '48px',
        'touch-lg': '64px',
        'touch-gap': '12px',
      },
      borderRadius: {
        card: '12px',
        button: '10px',
        input: '8px',
      },
      colors: {
        process: {
          mix: '#185FA5',
          ext: '#534AB7',
          cut: '#0F6E56',
          asm: '#D85A30',
          shp: '#5F5E5A',
        },
        status: {
          pass: { bg: '#E1F5EE', text: '#0F6E56', border: '#5DCAA5' },
          fail: { bg: '#FCEBEB', text: '#A32D2D', border: '#F09595' },
          pending: { bg: '#FAEEDA', text: '#854F0B', border: '#FAC775' },
          hold: { bg: '#FAECE7', text: '#993C1D', border: '#F0997B' },
          info: { bg: '#E6F1FB', text: '#185FA5', border: '#93C5FD' },
        },
        stock: {
          normal: '#0F6E56',
          warning: '#854F0B',
          danger: '#A32D2D',
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
