/**
 * FE-11 — Protección de navegación con formulario sucio.
 *
 * Los formularios largos (captura CxP, editor de conceptos, wizard de embarque)
 * perdían toda la captura al navegar o cerrar la pestaña sin ningún aviso.
 * Este hook avisa en ambos casos:
 *  1. `beforeunload` para cierre/recarga de la pestaña (diálogo nativo).
 *  2. Intercepción de clics en enlaces internos (`<a href>` del sidebar, tablas,
 *     breadcrumbs) mostrando el `ConfirmActionDialog` estándar.
 *
 * IMPORTANTE (v13.544.2): antes se usaba `useBlocker` de react-router, que
 * SÓLO existe en routers de datos (`createBrowserRouter`). La app monta
 * `<BrowserRouter>`, así que `useBlocker` lanzaba una excepción y tumbaba el
 * modal de captura de facturas de proveedor. La intercepción de clics no
 * depende del tipo de router.
 *
 * Uso:
 *   const { guardDialog } = useDirtyGuard(open && isDirty);
 *   // …en el JSX: {guardDialog}
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { useDirtyHistoryGuard } from "./useDirtyHistoryGuard";

/** ¿El clic corresponde a una navegación interna que debemos interceptar? */
function destinoInterno(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return null;
  }
  const anchor = (e.target as HTMLElement | null)?.closest?.("a");
  if (!anchor) return null;
  const href = anchor.getAttribute("href");
  if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const actual = window.location.pathname + window.location.search;
  return href === actual ? null : href;
}

export function useDirtyGuard(isDirty: boolean, guardHistory = false) {
  const navigate = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);
  // RFE-05: salida programática en espera de confirmación (no pasa por un <a>).
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null);
  const pendingExitRef = useRef(false);
  useEffect(() => () => { pendingExitRef.current = false; }, []);

  // 1) Cierre o recarga de la pestaña: diálogo nativo del navegador.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // 2) Navegación interna: interceptamos el clic y pedimos confirmación.
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (e: MouseEvent) => {
      const href = destinoInterno(e);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      pendingExitRef.current = true;
      setDestino(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  // Si el formulario deja de estar sucio, no dejamos el diálogo abierto.
  useEffect(() => {
    if (!isDirty) {
      pendingExitRef.current = false;
      setDestino(null);
      setAccionPendiente(null);
    }
  }, [isDirty]);

  /**
   * RFE-05 — Envuelve una salida programática: con el formulario sucio muestra
   * el mismo ConfirmActionDialog y sólo ejecuta la acción al confirmar; sin
   * cambios, la ejecuta de inmediato.
   */
  const confirmarSalida = useCallback(
    (accion: () => void) => {
      if (!isDirty) {
        accion();
        return;
      }
      pendingExitRef.current = true;
      setAccionPendiente(() => accion);
    },
    [isDirty],
  );

  const { isRestoring, isRestoringNow } = useDirtyHistoryGuard(isDirty && guardHistory, confirmarSalida);
  const confirmar = useCallback(() => {
    // Un POP repetido puede estar restaurándose antes del siguiente render;
    // el aviso anterior no debe ejecutar su delta ni cancelar esa restauración.
    if (isRestoringNow()) return;
    const href = destino;
    const accion = accionPendiente;
    pendingExitRef.current = false;
    setDestino(null);
    setAccionPendiente(null);
    if (accion) accion();
    else if (href) navigate(href);
  }, [destino, accionPendiente, navigate, isRestoringNow]);
  // Estable para que los callbacks del shell ya montados consulten el estado
  // actual, incluso antes del render que muestra el aviso de navegación.
  const isCloseBlocked = useCallback(
    () => pendingExitRef.current || isRestoringNow(),
    [isRestoringNow],
  );

  const isConfirming = destino !== null || accionPendiente !== null;
  const guardDialog = (
    <ConfirmActionDialog
      open={isConfirming}
      isPending={isRestoring}
      onOpenChange={(open) => {
        if (!open) {
          if (isRestoringNow()) return;
          pendingExitRef.current = false;
          setDestino(null);
          setAccionPendiente(null);
        }
      }}
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar en este formulario. Si sales ahora, se perderá lo capturado."
      confirmLabel="Salir sin guardar"
      cancelLabel="Seguir capturando"
      variant="destructive"
      onConfirm={confirmar}
    />
  );

  return { guardDialog, confirmarSalida, isConfirming,
    isNavigating: isRestoring || isConfirming, isCloseBlocked };
}
