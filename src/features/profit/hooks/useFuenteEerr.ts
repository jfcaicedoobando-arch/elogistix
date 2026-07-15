/**
 * Hook único para leer/escribir la preferencia de FUENTE del EERR
 * (`embarques` vs `facturas`). Antes vivía inline en `useEstadoResultados`;
 * ahora se comparte entre esa pantalla y el Dashboard Ejecutivo para evitar
 * KPIs contradictorios (auditoría Profit Batch H).
 *
 * Persistente en localStorage vía `safeLocalStorage` (regla
 * `mem://technical/browser-storage`) y reactivo entre pestañas mediante
 * `useSyncExternalStore` sobre el evento `storage`.
 */
import { useCallback, useSyncExternalStore } from "react";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";

export type FuenteEERR = "embarques" | "facturas";
const DEFAULT: FuenteEERR = "embarques";

function read(): FuenteEERR {
  return safeLocalStorage.getItem(STORAGE_KEYS.eerrFuente) === "facturas" ? "facturas" : DEFAULT;
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.eerrFuente || e.key === null) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("lc:eerr-fuente-change", cb as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("lc:eerr-fuente-change", cb as EventListener);
  };
}

export function useFuenteEerr(): { fuente: FuenteEERR; setFuente: (f: FuenteEERR) => void } {
  const fuente = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setFuente = useCallback((f: FuenteEERR) => {
    safeLocalStorage.setItem(STORAGE_KEYS.eerrFuente, f);
    // Notifica a otros consumidores en la MISMA pestaña (el evento `storage`
    // solo dispara entre pestañas distintas).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lc:eerr-fuente-change"));
    }
  }, []);
  return { fuente, setFuente };
}
