/**
 * Los importes de la tabla de conciliación deben etiquetarse con la moneda de
 * la cuenta bancaria seleccionada (antes siempre decía "MXN").
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { crearMovimientoColumns } from "../movimientoColumns";
import type { MovimientoBBVA } from "@/features/tesoreria/services";

function celda(id: string, moneda: string, mov: Partial<MovimientoBBVA>) {
  const cols = crearMovimientoColumns(() => undefined, moneda);
  const col = cols.find((c) => c.id === id);
  expect(col).toBeDefined();
  const cell = col?.cell;
  if (typeof cell !== "function") throw new Error("cell no es función");
  // SAFE-CAST: fixture mínimo; la celda sólo lee cargo/abono.
  return cell({ row: { original: mov } } as never) as React.ReactElement;
}

describe("crearMovimientoColumns — moneda", () => {
  it("usa USD en Cargo cuando la cuenta es USD", () => {
    render(celda("cargo", "USD", { cargo: 1200, abono: 0 }));
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it("usa MXN por defecto en Abono", () => {
    render(celda("abono", "MXN", { cargo: 0, abono: 500 }));
    expect(screen.getByText(/MXN/)).toBeInTheDocument();
  });
});
