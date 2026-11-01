import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiBackendTarget = process.env.INTERNAL_API_URL
  ? (process.env.INTERNAL_API_URL.endsWith("/:path*")
      ? process.env.INTERNAL_API_URL
      : `${process.env.INTERNAL_API_URL.replace(/\/+$/, "")}/:path*`)
  : "http://localhost:5000/api/:path*";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three"],
  experimental: {
    optimizePackageImports: ["three", "@react-three/drei", "lucide-react"],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: apiBackendTarget,
      },
    ];
  },
};

export default nextConfig;
