import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rawBasePath = process.env.BASE_PATH ?? "";
const basePath = rawBasePath.replace(/\/$/, "");

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  outputFileTracingRoot: dirname,
  transpilePackages: ["@workspace/api-client-react"],
};

export default nextConfig;
