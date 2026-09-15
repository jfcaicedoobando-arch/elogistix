/**
 * A11Y-NEW-09 — las fechas Desde/Hasta del estado de cuenta deben tener nombre
 * accesible (antes eran inputs anónimos).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoCuentaToolbar } from "../EstadoCuentaToolbar";

const noop = vi.fn();

describe("EstadoCuentaToolbar · accesibilidad", () => {
  it("expone Desde y Hasta por nombre accesible", () => {
    render(
      <EstadoCuentaToolbar
        cuentas={[{ id: "c1", alias: "BBVA MXN", banco: "BBVA", moneda: "MXN" }]}
        cuentaId="c1"
        onCuentaChange={noop}
        rango={{ desde: "2026-01-01", hasta: "2026-01-31" }}
        onRangoChange={noop}
        texto=""
        onTextoChange={noop}
        tipo="todos"
        onTipoChange={noop}
      />,
    );
    expect(screen.getByLabelText(/Desde \(fecha inicial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasta \(fecha final/i)).toBeInTheDocument();
  });
});
