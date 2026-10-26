import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { privacyContent } from "./src/privacy-content.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [{ name: "privacy-content", transformIndexHtml: html => html.replace("<!-- JANARTYS_PRIVACY_CONTENT -->", privacyContent()) }],
  build: {
    rollupOptions: { input: { app: fileURLToPath(new URL("./index.html", import.meta.url)), privacy: fileURLToPath(new URL("./privacy.html", import.meta.url)) } },
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
