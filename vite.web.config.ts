import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
  root: resolve("src/renderer"),
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@shared": resolve("src/shared"),
    },
  },
  plugins: [developmentCspPlugin, react()],
  server: {
    port: 5174,
    strictPort: true,
  },
});
