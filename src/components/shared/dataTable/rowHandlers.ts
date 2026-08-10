/**
 * Constructores de handlers de fila para `DataTableBody`. Extraídos para bajar
 * la complejidad ciclomática del cuerpo de la tabla (límite ESLint 16) y poder
 * probar la lógica de click/teclado/selección de forma aislada.
 */
import type { KeyboardEvent, MouseEvent } from "react";
import type { NavigateFunction } from "react-router-dom";
import { handleRowClick, handleRowKeyDown, isInteractiveDescendant } from "./rowNav";

export interface RowBehavior<T> {
  item: T;
  href: string | null;
  seleccionable: boolean;
  navigable: boolean;
  toggleSelected: () => void;
  navigate: NavigateFunction;
  onRowClick?: (item: T) => void;
}

export function buildRowClickHandler<T>(b: RowBehavior<T>) {
  return (e: MouseEvent) => {
    if (b.seleccionable) {
      if (isInteractiveDescendant(e.target)) return;
      b.toggleSelected();
      return;
    }
    if (b.navigable && b.href) {
      handleRowClick(e, { href: b.href, navigate: b.navigate });
      if (e.defaultPrevented) return;
    }
    if (b.onRowClick && !isInteractiveDescendant(e.target)) b.onRowClick(b.item);
  };
}

export function buildRowKeyDownHandler<T>(b: RowBehavior<T>) {
  return (e: KeyboardEvent) => {
    if (b.seleccionable) {
      if (isInteractiveDescendant(e.target)) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        b.toggleSelected();
      }
      return;
    }
    if (b.navigable && b.href) handleRowKeyDown(e, { href: b.href, navigate: b.navigate });
  };
}

export function buildRowAuxClickHandler<T>(b: RowBehavior<T>) {
  return (e: MouseEvent) => {
    if (b.navigable && b.href && e.button === 1) {
      e.preventDefault();
      window.open(b.href, "_blank", "noopener,noreferrer");
    }
  };
}
