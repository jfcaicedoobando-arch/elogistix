import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rastrea si un contenedor con `overflow-x-auto` tiene contenido oculto a la
 * izquierda o a la derecha, para renderizar sombras/degradados de scroll.
 *
 * Devuelve `{ ref, atStart, atEnd, overflowing }`:
 * - `atStart`: el scroll está pegado al borde izquierdo.
 * - `atEnd`: el scroll está pegado al borde derecho (o no hay overflow).
 * - `overflowing`: el contenido excede el ancho visible.
 *
 * Se actualiza en scroll + ResizeObserver (contenedor y su primer hijo) para
 * reaccionar a cambios de layout, redimensionado del sidebar y datos nuevos.
 */
export function useHorizontalScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState({ atStart: true, atEnd: true, overflowing: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflowing = scrollWidth - clientWidth > 1;
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
    setState((prev) =>
      prev.atStart === atStart && prev.atEnd === atEnd && prev.overflowing === overflowing
        ? prev
        : { atStart, atEnd, overflowing },
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  return { ref, ...state };
}
