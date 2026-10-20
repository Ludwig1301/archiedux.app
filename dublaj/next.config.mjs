import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_PATH } from "./lib/base-path.js";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: BASE_PATH,
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
};

export default nextConfig;
