/**
 * v13.89.3 — Hook para enfocar/scrollear/resaltar una sección dentro de un tab
 * cuando llega un deep-link con `?focus=<key>` (opcionalmente `&ids=a,b,c`).
 *
 * Uso:
 *   const { focus, ids, registerRef, clearFocus } = useFocusSection();
 *   <section ref={registerRef("cxc")} data-focus="cxc"> …
 *
 * Cuando `focus === key`, el ref hace scroll suave y aplica un ring pulsante
 * por 2.5s; luego se autolimpia el query param para que un refresh no
 * vuelva a resaltar.
 */
import { useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";

const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-primary",
  "ring-offset-2",
  "animate-pulse",
  "rounded-md",
];
const HIGHLIGHT_MS = 2500;

export function useFocusSection() {
  const [params, setParams] = useSearchParams();
  const focus = params.get("focus");
  const idsParam = params.get("ids");

  const ids = useMemo(
    () => (idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : []),
    [idsParam],
  );

  const handledRef = useRef<Set<string>>(new Set());

  const clearFocus = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("focus");
    next.delete("ids");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const registerRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (!node || focus !== key || handledRef.current.has(key)) return;
      handledRef.current.add(key);

      // Defer al siguiente frame: asegura que el tab ya renderizó.
      requestAnimationFrame(() => {
        try {
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {
          node.scrollIntoView();
        }
        node.classList.add(...HIGHLIGHT_CLASSES);
        window.setTimeout(() => {
          node.classList.remove(...HIGHLIGHT_CLASSES);
          // Limpia el param para que el highlight no se repita en refresh.
          const next = new URLSearchParams(window.location.search);
          next.delete("focus");
          next.delete("ids");
          const url = `${window.location.pathname}${
            next.toString() ? `?${next.toString()}` : ""
          }${window.location.hash}`;
          window.history.replaceState(window.history.state, "", url);
        }, HIGHLIGHT_MS);
      });
    },
    [focus],
  );

  return { focus, ids, registerRef, clearFocus };
}
