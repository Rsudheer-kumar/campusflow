import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProduction = process.env.NODE_ENV === "production";
const internalApiUrl = process.env.INTERNAL_API_URL?.trim();
const proxySecret = process.env.PROXY_SECRET?.trim();

let backendOrigin = "http://localhost:5000";

if (internalApiUrl) {
  // Normalize by stripping trailing /api and trailing slashes to prevent duplicate /api/api
  backendOrigin = internalApiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
} else if (process.env.NEXT_PUBLIC_API_URL) {
  backendOrigin = process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "").replace(/\/+$/, "");
} else if (isProduction) {
  backendOrigin = "https://campusflow-4rzn.onrender.com";
}

if (isProduction && (!proxySecret || proxySecret.length < 32)) {
  console.warn(
    "[CampusFlow Configuration Warning] PROXY_SECRET environment variable is not configured or shorter than 32 characters. " +
    "Direct API proxy forwarding will proceed without proxy secret header."
  );
}

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
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
