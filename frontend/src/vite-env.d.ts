/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base de l'API en prod (Edge Function Supabase). Vide en dev → proxy Vite vers le backend Node.
  readonly VITE_API_BASE?: string;
  // Clé publishable Supabase (publique) envoyée en en-tête `apikey` en prod.
  readonly VITE_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
