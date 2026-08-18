import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { hydrateFromCloud } from "./lib/cloudPrefs";
import "./styles.css";

// Hydrate les préférences depuis le cloud AVANT le montage : les composants lisent
// ensuite localStorage de façon synchrone comme avant (aucun changement côté UI).
hydrateFromCloud().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
