import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", transpilePackages: ["@warsneaks/domain", "@warsneaks/shared", "@warsneaks/db"] };
export default config;
