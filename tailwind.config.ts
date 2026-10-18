import type { Config } from 'tailwindcss';
export default { content: ['./src/**/*.{ts,tsx}'], theme: { extend: { colors: { arctic: { cyan: '#0DB8D3', sky: '#1B7FDC', ocean: '#065B98', abyss: '#193546', surface: '#07151E', dim: '#031018' } } } }, plugins: [] } satisfies Config;
