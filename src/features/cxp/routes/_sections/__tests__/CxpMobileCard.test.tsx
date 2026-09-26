import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import { CxpMobileCard } from "../CxpMobileCard";

vi.mock("@/features/cxp/components/EstadoFacturaCxPCell", () => ({
  EstadoFacturaCxPCell: () => <span>Vigente</span>,
}));

// El estado se prueba por separado; aquí sólo necesitamos los campos visibles de la tarjeta.
const factura = {
  folio_interno: "FP-000001", folio_proveedor: "QA-CODEX-FP-001",
  proveedor_nombre: "Transportes del Norte SA de CV", fecha_vencimiento: null,
  saldo: 1160, moneda: "MXN",
} as FacturaCxP;

describe("CxpMobileCard", () => {
  it("distingue folio interno/proveedor y no aplica ellipsis al saldo", () => {
    render(<CxpMobileCard factura={factura} />);
    expect(screen.getByText("Folio interno:")).toBeInTheDocument();
    expect(screen.getByText("Folio proveedor:")).toBeInTheDocument();
    expect(screen.getByText("FP-000001")).toBeInTheDocument();
    expect(screen.getByText("QA-CODEX-FP-001")).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(1160, "MXN"))).not.toHaveClass("truncate");
  });

  it("no inventa un folio de proveedor cuando no hay dato", () => {
    render(<CxpMobileCard factura={{ ...factura, folio_proveedor: "" }} />);
    expect(screen.queryByText("Folio proveedor:")).not.toBeInTheDocument();
  });
});
