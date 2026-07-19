import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const developmentCspPlugin = {
  name: "showme-development-csp",
  apply: "serve" as const,
  transformIndexHtml(html: string): string {
    return html
      .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
      .replace("connect-src 'self';", "connect-src 'self' ws: wss:;");
  },
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve("src/main/index.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve("src/preload/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
        },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
      },
    },
    plugins: [developmentCspPlugin, react()],
    build: {
      rollupOptions: {
        input: resolve("src/renderer/index.html"),
      },
    },
  },
});
