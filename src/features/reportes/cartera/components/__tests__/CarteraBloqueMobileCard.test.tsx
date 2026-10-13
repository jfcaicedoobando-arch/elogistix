import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { formatCurrency } from "@/lib/formatters";
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
  it.each([250, -250, 0])("permite consultar la valuación histórica y diferencia %s sin recalcular la fila", (diferencia) => {
    const row = fila({ moneda: "USD", saldo: 100, mxnHistorico: 1750, mxnCorte: 2000, diferencia });
    render(<CarteraBloqueMobileCard row={row} etiquetaContraparte="Cliente" />);
    const summary = screen.getByText("Ver detalle de valuación");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    const detail = within(details!);
    expect(detail.getByText("MXN histórico")).toBeInTheDocument();
    expect(detail.getByText("Dif. cambiaria")).toBeInTheDocument();
    expect(detail.getByText(formatCurrency(row.mxnHistorico, "MXN"))).toBeInTheDocument();
    expect(detail.getByText(formatCurrency(diferencia, "MXN"))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(row.mxnCorte, "MXN"))).toBeInTheDocument();
    expect(row.diferencia).toBe(diferencia);
    fireEvent.click(summary);
    expect(details).not.toHaveAttribute("open");
  });

  it("muestra contraparte, folio y saldo", () => {
    render(<CarteraBloqueMobileCard row={fila()} etiquetaContraparte="Cliente" />);
    expect(screen.getByText("Cliente X")).toBeInTheDocument();
    expect(screen.getByText(/F-1/)).toBeInTheDocument();
    const saldo = screen.getByText("Saldo").parentElement!;
    expect(within(saldo).getByText(/1,000\.00/)).toBeVisible();
  });
});
