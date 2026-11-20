import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

/**
 * PostgreSQL integration tests (`pnpm test:db`). Kept apart from `pnpm test`,
 * which needs no database. See src/lib/db/prisma-repository.db.test.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    // The tests share one database and clear it before each case.
    fileParallelism: false,
  },
});
