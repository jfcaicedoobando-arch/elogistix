import { useCallback, useEffect, useRef, useState } from "react";

export interface DesbordamientoVertical {
  /** Hay contenido oculto arriba del área visible. */
  hayArriba: boolean;
  /** Hay contenido oculto abajo del área visible. */
  hayAbajo: boolean;
}

/**
 * Detecta si un contenedor scrollable tiene contenido oculto arriba/abajo.
 *
 * Analogía: es el "hay más abajo" de un menú de restaurante largo; sin esa
 * pista el comensal cree que el menú termina donde se corta la hoja.
 *
 * Se usa en el rail colapsado del sidebar, donde la barra de scroll es casi
 * invisible y los últimos accesos parecían no existir.
 */
export function useDesbordamientoVertical<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  estado: DesbordamientoVertical;
} {
  const ref = useRef<T | null>(null);
  const [estado, setEstado] = useState<DesbordamientoVertical>({
    hayArriba: false,
    hayAbajo: false,
  });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const desborda = el.scrollHeight - el.clientHeight > 1;
    setEstado({
      hayArriba: desborda && el.scrollTop > 1,
      hayAbajo: desborda && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      ro?.disconnect();
    };
  }, [medir]);

  return { ref, estado };
}
