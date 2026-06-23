/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Move contents from /public to the root during export
  output: "export",
  // Keep the production build's artifacts out of the dev server's `.next/`.
  // `next build` (static export) and a live `next dev` otherwise share one
  // directory, and a build running alongside dev corrupts the dev manifests
  // (ENOENT on *-manifest.json). Separate dirs make them safe to run at once.
  // The export still emits to `out/` regardless of distDir.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

module.exports = nextConfig;
