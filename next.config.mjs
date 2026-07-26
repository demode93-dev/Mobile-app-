/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: this app has no server-side data needs (the Google Maps
  // key is a public, domain-restricted browser key), so it ships as plain
  // static files and deploys on Netlify the same way the previous SPA did.
  output: "export",
  reactStrictMode: true,
};

export default nextConfig;
