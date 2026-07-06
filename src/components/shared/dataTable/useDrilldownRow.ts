/**
 * Hook helper para hacer una fila/card completa navegable (drilldown).
 *
 * Uso:
 *   const nav = useDrilldownRow({ href: `/detalle/${id}`, ariaLabel: `Ver ${nombre}` });
 *   <li {...nav}>...</li>
 *
 * Devuelve props accesibles (role=link, tabIndex, teclado, Ctrl+click).
 * Ignora clicks provenientes de controles internos (buttons, inputs, menús)
 * mediante `data-no-row-nav` o selectores nativos.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { handleRowClick, handleRowKeyDown } from "./rowNav";

interface Params {
  href: string | null | undefined;
  ariaLabel?: string;
}

export function useDrilldownRow({ href, ariaLabel }: Params) {
  const navigate = useNavigate();

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!href) return;
      handleRowClick(e, { href, navigate });
    },
    [href, navigate],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!href) return;
      handleRowKeyDown(e, { href, navigate });
    },
    [href, navigate],
  );

  const onAuxClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!href) return;
      if (e.button === 1) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [href],
  );

  if (!href) return {};

  return {
    role: "link" as const,
    tabIndex: 0,
    "aria-label": ariaLabel,
    onClick,
    onKeyDown,
    onAuxClick,
    className: "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
  };
}
