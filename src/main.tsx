import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./lib/contexts/AuthContext";
import { OrganizationProvider } from "./lib/contexts/OrganizationContext";
import { ThemeProvider } from "./lib/contexts/ThemeContext";
import { queryClient } from "./lib/query/queryClient";
import { renderBootstrapFallback } from "./lib/bootstrap/renderBootstrapFallback";
import { startServices } from "./lib/bootstrap/startServices";
import {
  registerChunkRecoveryListeners,
  syncAppVersion,
} from "./lib/bootstrap/startupTasks";

syncAppVersion();
registerChunkRecoveryListeners();
startServices(queryClient);

// Red de seguridad de arranque: si el montaje raíz lanza antes del primer
// render (p. ej. un proveedor de contexto que falla al inicializar), el DOM
// quedaría vacío = pantalla en blanco sin explicación. Aquí lo convertimos en
// una pantalla de recuperación con botón "Recargar".
try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {/* QueryClientProvider debe envolver a AuthProvider: el perfil de usuario
          se resuelve con TanStack Query (M9). */}
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>
              <App />
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
} catch (error) {
  renderBootstrapFallback(error);
}
