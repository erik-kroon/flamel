import path from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    {
      name: "repo-data-fixtures",
      configureServer(server) {
        server.middlewares.use("/data", (request, response) => {
          const url = request.url?.replace(/^\//, "") ?? "";
          const file = path.resolve(__dirname, "../../data", url);

          if (!file.startsWith(path.resolve(__dirname, "../../data")) || !existsSync(file)) {
            response.statusCode = 404;
            response.end("Not found");
            return;
          }

          response.setHeader("Content-Type", "application/json");
          response.end(readFileSync(file));
        });
      },
      closeBundle() {
        const source = path.resolve(__dirname, "../../data/databento-market-data.json");
        const target = path.resolve(__dirname, "dist/data/databento-market-data.json");

        if (existsSync(source)) {
          mkdirSync(path.dirname(target), { recursive: true });
          copyFileSync(source, target);
        }
      },
    },
    tanstackRouter({ target: "solid", autoCodeSplitting: true }),
    solidPlugin(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
  },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
