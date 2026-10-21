import type { NextConfig } from 'next';
const config: NextConfig = { output: 'export', distDir: process.env.BILAD_NEXT_DIST_DIR || '.next', images: { unoptimized: true }, trailingSlash: true, devIndicators: false };
export default config;
