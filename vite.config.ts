import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { browserContextPlugin } from "./scripts/browser/plugin.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), browserContextPlugin()],
  worker: { format: "es", plugins: () => [browserContextPlugin()] },
});
