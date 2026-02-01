/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. BU ƏN VACİB SƏTİRDİR:
  // Bu sətir olmasa, SQLite xəta verəcək.
  serverExternalPackages: ["better-sqlite3"],

  // 2. Sənin Codespaces tənzimləmələrin (Bunu saxlayırıq)
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000", 
        "*.app.github.dev",
        "*.github.dev"
      ],
    },
  },
};

export default nextConfig;