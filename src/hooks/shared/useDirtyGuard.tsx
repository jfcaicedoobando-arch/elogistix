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
 * IMPORTANTE (v13.544.2): antes se usaba `useBlocker` de react-router-dom, que
 * SÓLO existe en routers de datos (`createBrowserRouter`). La app monta
 * `<BrowserRouter>`, así que `useBlocker` lanzaba una excepción y tumbaba el
 * modal de captura de facturas de proveedor. La intercepción de clics no
 * depende del tipo de router.
 *
 * Uso:
 *   const { guardDialog } = useDirtyGuard(open && isDirty);
 *   // …en el JSX: {guardDialog}
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

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

export function useDirtyGuard(isDirty: boolean) {
  const navigate = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);
  // RFE-05: salida programática en espera de confirmación (no pasa por un <a>).
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null);

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
      setDestino(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  // Si el formulario deja de estar sucio, no dejamos el diálogo abierto.
  useEffect(() => {
    if (!isDirty) {
      setDestino(null);
      setAccionPendiente(null);
    }
  }, [isDirty]);

  const confirmar = useCallback(() => {
    const href = destino;
    const accion = accionPendiente;
    setDestino(null);
    setAccionPendiente(null);
    if (accion) accion();
    else if (href) navigate(href);
  }, [destino, accionPendiente, navigate]);

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
      setAccionPendiente(() => accion);
    },
    [isDirty],
  );

  const guardDialog = (
    <ConfirmActionDialog
      open={destino !== null || accionPendiente !== null}
      onOpenChange={(open) => {
        if (!open) {
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

  return { guardDialog, confirmarSalida };
}
