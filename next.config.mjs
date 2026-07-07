/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Design deliveries upload files (images, PDFs, HTML exports) through
      // server actions — the 1 MB default would reject most of them, and
      // deliverables regularly exceed 50 MB.
      bodySizeLimit: "150mb",
    },
  },
};

export default nextConfig;
