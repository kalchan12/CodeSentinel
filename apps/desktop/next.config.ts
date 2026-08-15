import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@codesentinel/shared"],
};

export default nextConfig;