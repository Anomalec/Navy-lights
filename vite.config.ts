import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "remove-source-entry-redirect",
      transformIndexHtml(html) {
        return html.replace(
          /<meta\b(?=[^>]*\bid="source-entry-redirect")[^>]*>\s*/,
          "",
        );
      },
    },
    react(),
  ],
});
