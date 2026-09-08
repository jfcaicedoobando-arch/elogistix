/**
 * Lleva el foco (y la vista) al primer campo inválido de un formulario.
 *
 * VIS-20260908-04: al enviar un modal largo con un campo obligatorio vacío, el
 * aviso salía como toast temporal mientras el campo quedaba fuera de la vista y
 * el foco se quedaba en el botón. Con esto el usuario aterriza directamente en
 * el campo que debe corregir.
 */
export function enfocarPrimerInvalido(elementId: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(elementId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
}
