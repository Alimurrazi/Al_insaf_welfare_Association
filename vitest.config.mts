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
    // `prisma dev`'s local Postgres proxy intermittently throws
    // `portal "" does not exist` when multiple test files hit it
    // concurrently (each Vitest worker opens its own PrismaClient/connection
    // against the same single local instance). Running files sequentially
    // avoids that connection-pooling race; the suite is small enough that
    // this costs negligible wall-clock time.
    fileParallelism: false,
  },
});
