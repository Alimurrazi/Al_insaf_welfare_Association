import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test", quiet: true });

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
    },
  },
});
