import { createRoot } from "react-dom/client";
import "./lib/sentry"; // inicializa Sentry antes de montar React
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  clearChunkReloadFlag,
  hasChunkReloadBeenAttempted,
  markChunkReloadAttempted,
} from "./lib/browserStorage";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (hasChunkReloadBeenAttempted()) return;
  markChunkReloadAttempted();
  window.location.reload();
});

window.addEventListener("load", () => {
  clearChunkReloadFlag();
});

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <OrganizationProvider>
        <App />
      </OrganizationProvider>
    </AuthProvider>
  </ThemeProvider>
);
