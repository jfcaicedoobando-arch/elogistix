import { useCallback, useEffect, useState } from "react";
import { buildSelector, elementText, pickMeaningfulAncestor, shortLabel } from "@/lib/feedback/elementSelector";

export interface PickedElement {
  selector: string;
  texto: string;
}

const OVERLAY_ID = "feedback-picker-overlay";
const LABEL_ID = "feedback-picker-label";
const HINT_ID = "feedback-picker-hint";
const ACTIVE_CLASS = "feedback-picker-active";

/**
 * Picker tipo inspector con granularidad híbrida:
 * - Por defecto resalta el componente útil más cercano (botón, fila, card).
 * - Manteniendo Alt resalta el elemento exacto bajo el cursor.
 * - ↑↓ navega padre/hijo, Enter confirma, Esc / click derecho cancelan.
 * - Throttle con rAF + transform para movimiento suave.
 */
export function useElementPicker(onPicked: (el: PickedElement | null) => void) {
  const [active, setActive] = useState(false);

  const start = useCallback(() => setActive(true), []);
  const stop = useCallback(() => setActive(false), []);

  useEffect(() => {
    if (!active) return;

    // -- DOM overlays --
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;border:2px solid hsl(217 91% 60%);background:hsl(217 91% 60% / 0.12);z-index:2147483646;border-radius:6px;transform:translate(0,0);transition:transform 90ms ease,width 90ms ease,height 90ms ease,opacity 120ms ease;opacity:0;box-shadow:0 0 0 9999px hsl(222 47% 11% / 0.18);";
    document.body.appendChild(overlay);

    const label = document.createElement("div");
    label.id = LABEL_ID;
    label.style.cssText =
      "position:fixed;left:0;top:0;pointer-events:none;background:hsl(217 91% 60%);color:#fff;padding:3px 8px;border-radius:4px;font:600 11px/1.3 Inter,system-ui,sans-serif;z-index:2147483647;white-space:nowrap;max-width:380px;overflow:hidden;text-overflow:ellipsis;transform:translate(0,0);transition:transform 90ms ease,opacity 120ms ease;opacity:0;box-shadow:0 2px 8px rgba(0,0,0,.25);";
    document.body.appendChild(label);

    const hint = document.createElement("div");
    hint.id = HINT_ID;
    hint.textContent =
      "Click: seleccionar · Alt: exacto · ↑↓: padre/hijo · Enter: confirmar · Esc/Click derecho: cancelar";
    hint.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:hsl(222 47% 11%);color:#fff;padding:6px 14px;border-radius:999px;font:600 12px Inter,system-ui,sans-serif;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.3);pointer-events:none;";
    document.body.appendChild(hint);

    document.documentElement.classList.add(ACTIVE_CLASS);
    document.body.style.cursor = "crosshair";

    // -- State --
    let hovered: Element | null = null; // último elemento debajo del cursor (sin alt)
    let current: Element | null = null; // target resaltado actual
    let altDown = false;
    const downStack: Element[] = []; // para ArrowDown tras ArrowUp
    let rafId = 0;
    let lastEvent: { x: number; y: number } | null = null;

    const isOurs = (el: Element | null) =>
      !!el && (el.id === OVERLAY_ID || el.id === LABEL_ID || el.id === HINT_ID);

    const paint = (el: Element | null) => {
      if (!el || el === document.body || el === document.documentElement) {
        overlay.style.opacity = "0";
        label.style.opacity = "0";
        return;
      }
      if (el === current) return;
      current = el;
      const r = el.getBoundingClientRect();
      overlay.style.transform = `translate(${r.left}px,${r.top}px)`;
      overlay.style.width = `${r.width}px`;
      overlay.style.height = `${r.height}px`;
      overlay.style.opacity = "1";

      const txt = elementText(el);
      const altSuffix = altDown ? " · exacto" : "";
      label.textContent = `${shortLabel(el)}${txt ? ` — ${txt.slice(0, 40)}` : ""}${altSuffix}`;
      // posicionar arriba si cabe, si no debajo
      const labelH = 22;
      const top = r.top - labelH - 4 >= 0 ? r.top - labelH - 4 : Math.min(window.innerHeight - labelH, r.bottom + 4);
      const left = Math.max(4, Math.min(window.innerWidth - 200, r.left));
      label.style.transform = `translate(${left}px,${top}px)`;
      label.style.opacity = "1";
    };

    const resolveFromPoint = (x: number, y: number): Element | null => {
      // elementsFromPoint devuelve la pila completa; filtramos nuestros propios overlays
      // y cualquier elemento "no útil" para evitar resaltar body/html.
      const stack = document.elementsFromPoint(x, y);
      const el = stack.find((n) => !isOurs(n) && n !== document.body && n !== document.documentElement);
      if (!el) return hovered;
      return altDown ? el : pickMeaningfulAncestor(el);
    };

    const scheduleRepaint = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!lastEvent) return;
        const next = resolveFromPoint(lastEvent.x, lastEvent.y);
        if (next) {
          hovered = next;
          downStack.length = 0;
          paint(next);
        }
      });
    };

    // -- Handlers --
    const onMove = (e: MouseEvent) => {
      lastEvent = { x: e.clientX, y: e.clientY };
      scheduleRepaint();
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = current ?? hovered;
      if (target && !isOurs(target)) {
        onPicked({ selector: buildSelector(target), texto: elementText(target) });
      }
      setActive(false);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPicked(null);
      setActive(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onPicked(null);
        setActive(false);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = current ?? hovered;
        if (target) onPicked({ selector: buildSelector(target), texto: elementText(target) });
        setActive(false);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!current) return;
        const parent = current.parentElement;
        if (parent && parent !== document.body) {
          downStack.push(current);
          paint(parent);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const child = downStack.pop();
        if (child) paint(child);
        return;
      }
      if ((e.key === "Alt" || e.key === "Shift") && !altDown) {
        altDown = true;
        if (lastEvent) {
          const next = resolveFromPoint(lastEvent.x, lastEvent.y);
          if (next) { hovered = next; current = null; paint(next); }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt" || e.key === "Shift") {
        altDown = false;
        if (lastEvent) {
          const next = resolveFromPoint(lastEvent.x, lastEvent.y);
          if (next) { hovered = next; current = null; paint(next); }
        }
      }
    };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);

    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      if (rafId) cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      document.documentElement.classList.remove(ACTIVE_CLASS);
      overlay.remove();
      label.remove();
      hint.remove();
    };
  }, [active, onPicked]);

  return { active, start, stop };
}
