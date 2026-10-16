/**
 * useRadixPointerEventsRescue
 *
 * Rescate global contra el bug de Radix UI que deja `<body>` con
 * `pointer-events: none` y `data-scroll-locked` después de cerrar un
 * Select / Dialog / Dropdown — la página queda "congelada" (no responden
 * clicks en headers de tablas, botones, filas, etc.) sin error visible.
 *
 * Estrategia: observamos los cambios a `style` y `data-scroll-locked` del
 * body. Si quedan en estado "bloqueado" PERO ya no existe ningún overlay
 * Radix abierto en el DOM, los retiramos. Si Radix vuelve a abrir un
 * overlay, los reaplica él mismo.
 *
 * Cleanup obligatorio del observer y del rescate pendiente (regla Power of 10).
 */
import { useEffect } from "react";

const OPEN_OVERLAY_SELECTOR = [
  '[data-radix-popper-content-wrapper] [data-state="open"]',
  '[role="dialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
].join(",");

function hasOpenOverlay(): boolean {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

export function useRadixPointerEventsRescue(): void {
  useEffect(() => {
    const body = document.body;
    let mounted = true;
    let pendingRescue: ReturnType<typeof setTimeout> | undefined;

    function rescueIfStuck(): void {
      if (!mounted || pendingRescue !== undefined) return;
      const locked =
        body.style.pointerEvents === "none" ||
        body.hasAttribute("data-scroll-locked");
      if (!locked || hasOpenOverlay()) return;
      // Radix puede abrir otro overlay antes del rescate: verificar de nuevo.
      pendingRescue = setTimeout(() => {
        pendingRescue = undefined;
        if (!mounted || hasOpenOverlay()) return;
        if (body.style.pointerEvents === "none") {
          body.style.pointerEvents = "";
        }
        if (body.hasAttribute("data-scroll-locked")) {
          body.removeAttribute("data-scroll-locked");
        }
      }, 50);
    }

    const observer = new MutationObserver(rescueIfStuck);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
    });
    return () => {
      mounted = false;
      observer.disconnect();
      if (pendingRescue !== undefined) clearTimeout(pendingRescue);
    };
  }, []);
}
