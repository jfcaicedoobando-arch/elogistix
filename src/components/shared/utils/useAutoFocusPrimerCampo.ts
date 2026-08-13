/**
 * Enfoca el primer campo útil de un modal al abrirse.
 *
 * Por qué: hasta ahora casi todos los modales abrían con el foco en el
 * contenedor, así que el usuario tenía que tabular varias veces (o usar el
 * mouse) antes de escribir. Radix ya atrapa el foco dentro del diálogo; esto
 * sólo decide *dónde* cae.
 *
 * Reglas:
 *  - se salta botones, campos deshabilitados/readOnly y controles marcados con
 *    `data-autofocus="skip"`;
 *  - respeta un campo que ya declare `autofocus`;
 *  - no hace nada si `enabled` es false (modales de lectura o confirmación).
 *
 * Cleanup obligatorio del timeout (regla core del proyecto).
 */
import { useEffect, useRef } from "react";

const SELECTOR_CAMPOS = [
  "input:not([type=hidden]):not([disabled]):not([readonly])",
  "textarea:not([disabled]):not([readonly])",
  "select:not([disabled])",
  '[role="combobox"]:not([disabled])',
].join(",");

function esEnfocable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.dataset.autofocus === "skip") return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.tabIndex < 0) return false;
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

export function useAutoFocusPrimerCampo(open: boolean, enabled = true) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !enabled) return;
    // Radix monta el contenido y mueve el foco en el siguiente frame; sin este
    // diferido el foco se lo queda el contenedor del diálogo.
    const t = setTimeout(() => {
      const raiz = ref.current;
      if (!raiz) return;
      const declarado = raiz.querySelector<HTMLElement>("[autofocus]");
      const objetivo =
        declarado && esEnfocable(declarado)
          ? declarado
          : Array.from(raiz.querySelectorAll(SELECTOR_CAMPOS)).find(esEnfocable);
      objetivo?.focus();
      if (objetivo instanceof HTMLInputElement && objetivo.value) objetivo.select();
    }, 60);
    return () => clearTimeout(t);
  }, [open, enabled]);

  return ref;
}
