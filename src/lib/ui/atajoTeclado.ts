/**
 * Etiqueta del atajo de búsqueda global según la plataforma.
 *
 * v13.823.49 — el hint mostraba siempre "⌘K", así que en Windows/Linux el
 * usuario veía una tecla que no existe en su teclado.
 */

/** ¿El navegador corre en macOS/iOS? Defensivo ante entornos sin `navigator`. */
export function esMac(nav?: { platform?: string; userAgent?: string }): boolean {
  const n = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  if (!n) return false;
  const fuente = `${n.platform ?? ""} ${n.userAgent ?? ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(fuente);
}

/** "⌘K" en macOS, "Ctrl+K" en el resto. */
export function atajoBusquedaGlobal(nav?: { platform?: string; userAgent?: string }): string {
  return esMac(nav) ? "⌘K" : "Ctrl+K";
}

/** "⌘P" en macOS, "Ctrl+P" en el resto (paleta del CRM). */
export function atajoCrmPalette(nav?: { platform?: string; userAgent?: string }): string {
  return esMac(nav) ? "⌘P" : "Ctrl+P";
}
