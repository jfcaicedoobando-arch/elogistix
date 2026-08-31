/**
 * Simula un clic fuera del contenido de un `<Dialog>` de Radix (overlay).
 * Radix registra el listener de `pointerdown` en un `setTimeout(0)` para no
 * cerrar el modal con el mismo clic que lo abrió, por eso hay que esperar un
 * tick antes de disparar la secuencia completa de eventos de puntero.
 */
import { act } from "@testing-library/react";

export async function esperarTickRadix() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export function clickFueraDelDialogo() {
  const overlay = document.querySelector('[data-state="open"].fixed.inset-0') as HTMLElement | null;
  if (!overlay) throw new Error("No se encontró el overlay del Dialog abierto");
  act(() => {
    for (const [Ctor, type] of [
      [PointerEvent, "pointerdown"],
      [MouseEvent, "mousedown"],
      [PointerEvent, "pointerup"],
      [MouseEvent, "mouseup"],
      [MouseEvent, "click"],
    ] as const) {
      overlay.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true }));
    }
  });
}
