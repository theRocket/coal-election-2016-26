import { defineConfig } from "vite";

// Served from GitHub Pages as a project site: https://ryanrickerts.dev/coal-election-2016-26/
export default defineConfig({
  base: "/coal-election-2016-26/",
  build: { target: "es2022" }, // top-level await in src/main.js
});
