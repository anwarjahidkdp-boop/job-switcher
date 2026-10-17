import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "cv-browser-libs": fileURLToPath(new URL("./src/lib/cv/browser-libs.ts", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "workers/**/src/**/*.test.ts"], environment: "node" },
});
