import type { NextConfig } from 'next';
const config: NextConfig = { distDir: process.env.BILAD_NEXT_DIST_DIR || '.next', images: { unoptimized: true }, trailingSlash: true, devIndicators: false };
export default config;
