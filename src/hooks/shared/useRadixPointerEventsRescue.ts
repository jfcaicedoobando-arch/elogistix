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
 * Cleanup obligatorio del observer (regla Power of 10).
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

function rescueIfStuck(): void {
  const body = document.body;
  if (!body) return;
  const locked =
    body.style.pointerEvents === "none" ||
    body.hasAttribute("data-scroll-locked");
  if (!locked) return;
  if (hasOpenOverlay()) return;
  // Defer un tick: Radix puede estar abriendo otro overlay en el mismo frame.
  setTimeout(() => {
    if (hasOpenOverlay()) return;
    if (document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
    if (document.body.hasAttribute("data-scroll-locked")) {
      document.body.removeAttribute("data-scroll-locked");
    }
  }, 50);
}

export function useRadixPointerEventsRescue(): void {
  useEffect(() => {
    const observer = new MutationObserver(rescueIfStuck);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);
}
