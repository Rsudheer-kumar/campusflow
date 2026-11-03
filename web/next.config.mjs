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
} else if (isProduction) {
  throw new Error(
    "[CampusFlow Configuration Error] INTERNAL_API_URL environment variable is required in production deployment. " +
    "Please configure INTERNAL_API_URL in the Render dashboard to your backend service URL (e.g. https://<backend-service>.onrender.com)."
  );
}

if (isProduction && (!proxySecret || proxySecret.length < 32)) {
  throw new Error(
    "[CampusFlow Configuration Error] PROXY_SECRET environment variable is required in production deployment (minimum 32 characters). " +
    "Please configure PROXY_SECRET in the Render dashboard with the matching backend secret."
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
