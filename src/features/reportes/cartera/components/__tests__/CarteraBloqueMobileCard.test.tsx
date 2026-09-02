import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarteraBloqueMobileCard } from "../CarteraBloqueMobileCard";
import type { FilaCartera } from "@/features/reportes/cartera/domain/agingCartera";

function fila(overrides: Partial<FilaCartera> = {}): FilaCartera {
  return {
    id: "1", folio: "F-1", contraparte: "Cliente X", expediente: "EXP-1",
    moneda: "MXN", saldo: 1000, fechaEmision: "2026-01-01", fechaVencimiento: "2026-02-01",
    tipoCambio: 1, diasVencido: 10, bucket: "d_1_30", mxnHistorico: 1000, mxnCorte: 1010,
    diferencia: 10,
    ...overrides,
  };
}

describe("CarteraBloqueMobileCard", () => {
  it("muestra contraparte, folio y saldo", () => {
    render(<CarteraBloqueMobileCard row={fila()} etiquetaContraparte="Cliente" />);
    expect(screen.getByText("Cliente X")).toBeInTheDocument();
    expect(screen.getByText(/F-1/)).toBeInTheDocument();
    expect(screen.getByText(/1,000\.00/)).toBeInTheDocument();
  });
});
