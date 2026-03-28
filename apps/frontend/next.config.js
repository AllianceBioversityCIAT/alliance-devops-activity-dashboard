/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  // Generate folder indexes so CloudFront Function can rewrite /path -> /path/index.html
  trailingSlash: true,
  eslint: {
    // Avoid failing the production build on ESLint errors
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
