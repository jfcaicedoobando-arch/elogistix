/**
 * Helpers para drilldown accesible en filas de tabla y tarjetas mobile.
 *
 * Convención transversal (v13.200.0):
 * - `getRowHref` disponible en `DataTable` / `ResponsiveDataTable`.
 * - Fila = `role="link"` + `tabIndex=0` + click/keyboard/Ctrl+click.
 * - Los controles internos (checkbox, botones, dropdown) llevan
 *   `data-no-row-nav` o `stopPropagation` para no chocar.
 */
import type { KeyboardEvent, MouseEvent } from "react";
import type { NavigateFunction } from "react-router-dom";

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="checkbox"], [role="switch"], [role="tab"], [data-no-row-nav]';

/** ¿El evento se originó en un control interactivo dentro de la fila? */
export function isInteractiveDescendant(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(INTERACTIVE_SELECTOR);
}

/** Abre `href` en pestaña nueva si el modificador correspondiente está presente. */
export function shouldOpenInNewTab(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.button === 1 || e.shiftKey;
}

interface HandleRowClickOpts {
  href: string;
  navigate: NavigateFunction;
}

export function handleRowClick(e: MouseEvent, opts: HandleRowClickOpts) {
  if (isInteractiveDescendant(e.target)) return;
  if (e.defaultPrevented) return;
  if (shouldOpenInNewTab(e)) {
    e.preventDefault();
    window.open(opts.href, "_blank", "noopener,noreferrer");
    return;
  }
  opts.navigate(opts.href);
}

export function handleRowKeyDown(e: KeyboardEvent, opts: HandleRowClickOpts) {
  if (isInteractiveDescendant(e.target)) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    opts.navigate(opts.href);
  }
}
