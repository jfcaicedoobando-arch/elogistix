/**
 * Atajos de teclado del CRM.
 * - `n` → abre QuickAddMenu (callback `onOpenQuick`)
 * - `l` / `o` / `a` → atajo directo a crear lead / oportunidad / actividad
 *
 * Ignora cuando el foco está en input, textarea, [contenteditable] o un
 * Radix menu/dialog abierto (data-state="open").
 */
import { useEffect } from "react";

export interface CrmHotkeyHandlers {
  onOpenQuick: () => void;
  onNewLead: () => void;
  onNewOportunidad: () => void;
  onNewActividad: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useCrmHotkeys(handlers: CrmHotkeyHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); handlers.onOpenQuick(); return; }
      if (k === "l") { e.preventDefault(); handlers.onNewLead(); return; }
      if (k === "o") { e.preventDefault(); handlers.onNewOportunidad(); return; }
      if (k === "a") { e.preventDefault(); handlers.onNewActividad(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
