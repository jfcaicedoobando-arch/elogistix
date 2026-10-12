import { renderBootstrapFallback } from "@/lib/bootstrap/renderBootstrapFallback";

const NOTICE_ID = "chunk-recovery-notice";
const MESSAGE = "No pudimos cargar un módulo. Guarda tus cambios antes de recargar e intentarlo de nuevo.";

/** Nunca sustituir el árbol React activo: el usuario puede haber cancelado la recarga. */
export function showChunkRecoveryFallback(): void {
  const root = document.getElementById("root");
  if (!root?.hasChildNodes()) {
    renderBootstrapFallback(new Error(MESSAGE));
    return;
  }
  if (document.getElementById(NOTICE_ID)) return;
  const notice = document.createElement("section");
  notice.id = NOTICE_ID;
  notice.setAttribute("role", "alert");
  notice.className = "fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg";
  const message = document.createElement("p");
  message.textContent = MESSAGE;
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Recargar";
  reload.className = "mt-3 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground";
  reload.addEventListener("click", () => window.location.reload());
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Seguir trabajando";
  dismiss.className = "ml-2 mt-3 rounded-md border border-border px-3 py-2 text-sm";
  dismiss.addEventListener("click", () => notice.remove());
  notice.append(message, reload, dismiss);
  document.body.append(notice);
}
