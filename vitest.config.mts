import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  // I test non elaborano i CSS (niente PostCSS/Tailwind).
  css: { postcss: { plugins: [] } },
  test: { environment: "node", css: false, include: process.env.ANTEPRIMA ? ["strumenti/**/*.test.tsx"] : ["src/**/*.test.{ts,tsx}"] },
});
