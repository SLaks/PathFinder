import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({}) => {
  return {
    server: {
      watch: {
        ignored: ["**/*.test.ts", "**/*.test.tsx"],
      },
    },

    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
