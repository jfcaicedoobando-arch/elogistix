/** v13.823.25: tarjeta móvil de /cobranza muestra folio, cliente, vencimiento y saldo. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarteraMobileCard } from "../CarteraMobileCard";
import type { CarteraRow } from "@/features/bandejas/routes/_sections/carteraColumns.types";

function row(overrides: Partial<CarteraRow> = {}): CarteraRow {
  return {
    factura_id: "f1", numero: "FAC-1", cliente_nombre: "Cliente Uno",
    expediente: "EXP-1", embarque_id: null, fecha_vencimiento: "2026-02-01",
    dias_vencido: -5, moneda: "MXN", total: 100, saldo: 100, ultimo_contacto: null,
    ...overrides,
  } as CarteraRow;
}

describe("CarteraMobileCard", () => {
  it("muestra folio, cliente y saldo con moneda", () => {
    render(<CarteraMobileCard row={row()} />);
    expect(screen.getByText("FAC-1")).toBeInTheDocument();
    expect(screen.getByText("Cliente Uno")).toBeInTheDocument();
    expect(screen.getByText(/\$1,?00\.00|100\.00/)).toBeInTheDocument();
  });
});
