import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";

const CHUNK_ERROR_RELOAD_KEY = "chunk-error-auto-reload";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  if (window.sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) === "1") {
    return;
  }

  window.sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
  window.location.reload();
});

window.addEventListener("load", () => {
  window.sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
});

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <OrganizationProvider>
      <App />
    </OrganizationProvider>
  </AuthProvider>
);
