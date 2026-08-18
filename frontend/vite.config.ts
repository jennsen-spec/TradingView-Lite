import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En prod (GitHub Pages, projet TradingView-Lite) l'app est servie sous /TradingView-Lite/.
// En dev on reste à la racine.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/TradingView-Lite/" : "/",
  server: {
    port: 5173,
    // Le front appelle /api/... et Vite le renvoie vers le backend Express (dev local).
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
}));
