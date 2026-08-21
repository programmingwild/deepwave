/** @type {import('next').NextConfig} */

// GitHub Pages serves the site under /<repo-name>, so the deploy workflow
// sets NEXT_PUBLIC_BASE_PATH. Local dev/build stays unprefixed.
// NEXT_OUTPUT_EXPORT=1 switches to a fully static export (out/ directory),
// which is what GitHub Pages needs.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  ...(isStaticExport ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
