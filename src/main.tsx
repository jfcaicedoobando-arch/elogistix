import { createRoot } from "react-dom/client";
import "./lib/sentry"; // inicializa Sentry antes de montar React
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { clearChunkReloadFlag } from "./lib/browserStorage";
import {
  isDynamicImportError,
  tryReloadForChunkError,
} from "./lib/ui/dynamicImportError";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  tryReloadForChunkError();
});

// React.lazy() rechaza la promesa sin disparar vite:preloadError cuando el
// fallo viene del propio `import()`. Capturarlo aquí evita ruido en Sentry
// y garantiza el reload de auto-recuperación.
window.addEventListener("unhandledrejection", (event) => {
  if (!isDynamicImportError(event.reason)) return;
  event.preventDefault();
  tryReloadForChunkError();
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
