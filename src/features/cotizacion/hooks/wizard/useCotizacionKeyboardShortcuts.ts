/**
 * Atajos de teclado del wizard de cotización (P1 — v13.294.0).
 *
 *  - Ctrl/Cmd + Enter → Siguiente paso o Guardar (según paso).
 *  - Ctrl/Cmd + ArrowLeft → Anterior.
 *  - Ctrl/Cmd + S → Fuerza flush del autosave (no navega).
 *
 * Cleanup obligatorio (regla core del proyecto).
 * NO intercepta cuando el foco está en textarea/contenteditable/select-abierto
 * para no romper flujos de edición.
 */
import { useEffect } from "react";

interface Params {
  currentStep: number;
  enabled?: boolean;
  onNext: () => void;
  onSave: () => void;
  onBack: () => void;
  onFlushDraft?: () => void;
}

/**
 * COT-UX-01: dentro de un INPUT, Ctrl/Cmd+← se usa para mover el cursor; si
 * navegamos al paso anterior el usuario pierde el foco y lo escrito.
 */
const TAGS_EDICION = new Set(["TEXTAREA", "INPUT", "SELECT"]);

function isEditingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (TAGS_EDICION.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute("role") === "textbox") return true;
  return false;
}

export function useCotizacionKeyboardShortcuts({
  currentStep, enabled = true, onNext, onSave, onBack, onFlushDraft,
}: Params): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Ctrl/Cmd + S — guardar borrador manual.
      if (key === "s") {
        if (isEditingContext(e.target)) return;
        e.preventDefault();
        onFlushDraft?.();
        return;
      }

      // Ctrl/Cmd + Enter — siguiente o guardar (paso 4).
      if (key === "enter") {
        e.preventDefault();
        if (currentStep >= 4) onSave();
        else onNext();
        return;
      }

      // Ctrl/Cmd + ArrowLeft — retroceder.
      if (key === "arrowleft") {
        if (isEditingContext(e.target)) return;
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, currentStep, onNext, onSave, onBack, onFlushDraft]);
}
