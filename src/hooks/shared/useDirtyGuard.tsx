/**
 * FE-11 — Protección de navegación con formulario sucio.
 *
 * Los formularios largos (captura CxP, editor de conceptos, wizard de embarque)
 * perdían toda la captura al navegar o cerrar la pestaña sin ningún aviso.
 * Este hook avisa en ambos casos:
 *  1. `beforeunload` para cierre/recarga de la pestaña (diálogo nativo).
 *  2. `useBlocker` de react-router-dom v6 para navegación interna, mostrando el
 *     `ConfirmActionDialog` estándar.
 *
 * Uso:
 *   const { guardDialog } = useDirtyGuard(open && isDirty);
 *   // …en el JSX: {guardDialog}
 */
import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

export function useDirtyGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const blocker = useBlocker(isDirty);

  const guardDialog = (
    <ConfirmActionDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar en este formulario. Si sales ahora, se perderá lo capturado."
      confirmLabel="Salir sin guardar"
      cancelLabel="Seguir capturando"
      variant="destructive"
      onConfirm={() => {
        if (blocker.state === "blocked") blocker.proceed();
      }}
    />
  );

  return { guardDialog };
}
