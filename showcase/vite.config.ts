/// <reference types="vitest/config" />
import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Public origin used for absolute Open Graph URLs. Not a secret.
const SITE_URL = (process.env.SITE_URL ?? "https://reklamaton-demo.vercel.app").replace(/\/$/, "")

// `vite preview` (used by the browser tests) sends the same security headers as Vercel, CSP included.
const vercel = JSON.parse(readFileSync(path.resolve(__dirname, "vercel.json"), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const previewHeaders = Object.fromEntries(
  vercel.headers.find((h) => h.source === "/(.*)")!.headers.map((h) => [h.key, h.value]),
)

const siteUrl = (): Plugin => ({
  name: "site-url",
  transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", SITE_URL),
})

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrl()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true, headers: previewHeaders },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
