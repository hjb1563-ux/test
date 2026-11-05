/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, logging: { incomingRequests: { ignore: [/\/admin\/setup-password(?:[?\/]|$)/] } } };
export default nextConfig;
