import { useCallback, useEffect, useRef, useState } from "react";
import { buildSelector, elementText } from "@/lib/feedback/elementSelector";

export interface PickedElement {
  selector: string;
  texto: string;
}

/**
 * Hook que activa un modo "picker" tipo inspector. Resalta el elemento bajo
 * el cursor con un overlay outline y al hacer click captura su selector y texto.
 * Esc cancela. Devuelve el elemento elegido vía `onPicked`.
 */
export function useElementPicker(onPicked: (el: PickedElement | null) => void) {
  const [active, setActive] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const start = useCallback(() => setActive(true), []);
  const stop = useCallback(() => setActive(false), []);

  useEffect(() => {
    if (!active) return;

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;pointer-events:none;border:2px solid hsl(217 91% 60%);background:hsl(217 91% 60% / 0.15);z-index:2147483646;transition:all 60ms ease;border-radius:4px;";
    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    const hint = document.createElement("div");
    hint.textContent = "Click para seleccionar · Esc para cancelar";
    hint.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:hsl(222 47% 11%);color:#fff;padding:6px 12px;border-radius:6px;font:600 12px Inter,system-ui,sans-serif;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.3);";
    document.body.appendChild(hint);

    document.body.style.cursor = "crosshair";

    let last: Element | null = null;

    const move = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === overlay || el === hint) return;
      last = el;
      const r = el.getBoundingClientRect();
      overlay.style.left = `${r.left}px`;
      overlay.style.top = `${r.top}px`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
    };

    const click = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = last ?? document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== overlay && el !== hint) {
        onPicked({ selector: buildSelector(el), texto: elementText(el) });
      }
      setActive(false);
    };

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onPicked(null);
        setActive(false);
      }
    };

    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);

    return () => {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
      document.body.style.cursor = "";
      overlay.remove();
      hint.remove();
      overlayRef.current = null;
    };
  }, [active, onPicked]);

  return { active, start, stop };
}
