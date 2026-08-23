import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En prod (GitHub Pages, projet TradingView-Lite) l'app est servie sous /TradingView-Lite/.
// En dev on reste à la racine.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/TradingView-Lite/" : "/",
  server: {
    // Port fourni par l'environnement quand plusieurs sessions tournent en parallèle ;
    // sinon Vite prend son défaut (5173) et incrémente si le port est déjà pris.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    // Le front appelle /api/... et Vite le renvoie vers le backend Express (dev local).
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
}));
