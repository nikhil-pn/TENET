/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Move contents from /public to the root during export
  output: "export",
};

module.exports = nextConfig;
