/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    RELAY_URL: process.env.RELAY_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
