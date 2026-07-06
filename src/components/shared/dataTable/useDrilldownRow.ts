/**
 * Hook helper para hacer una fila/card completa navegable (drilldown).
 *
 * Devuelve props para aplicar a un `<li>`, `<div>` o `<tr>` que se comporte
 * como link accesible: click, Enter/Space, Ctrl/Cmd+click en nueva pestaña,
 * `role="link"`, `aria-label`, y foco visible con el token `--ring`.
 *
 * Ignora clicks provenientes de controles internos (buttons, inputs, menús)
 * mediante `event.target.closest('button, a, [role="menuitem"], input, [data-no-row-nav]')`.
 *
 * Uso:
 *   const nav = useDrilldownRow({ href: `/detalle/${id}`, ariaLabel: `Ver ${nombre}` });
 *   <li {...nav}>...</li>
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { handleRowClick, handleRowKeyDown, isInteractiveDescendant, shouldOpenInNewTab } from "./rowNav";

interface Params {
  href: string | null | undefined;
  ariaLabel?: string;
}

export function useDrilldownRow({ href, ariaLabel }: Params) {
  const navigate = useNavigate();

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!href) return;
      if (isInteractiveTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.button === 1) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      navigate(href);
    },
    [href, navigate],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!href) return;
      if (isInteractiveTarget(e.target)) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(href);
      }
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
