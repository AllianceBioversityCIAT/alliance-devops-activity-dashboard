/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  // For S3+CloudFront (REST origin), prefer .html files over folder indexes
  // Use /auth.html as callback to avoid directory index issues
  trailingSlash: false,
  eslint: {
    // Avoid failing the production build on ESLint errors
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
