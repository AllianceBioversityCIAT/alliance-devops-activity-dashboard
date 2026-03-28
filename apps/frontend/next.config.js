/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  eslint: {
    // Avoid failing the production build on ESLint errors
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
