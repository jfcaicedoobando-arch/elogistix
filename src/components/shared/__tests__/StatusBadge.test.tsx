import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getStatusVisual, DOMAIN_STATUSES } from "@/lib/status/statusRegistry";

describe("statusRegistry", () => {
  it("resuelve estado conocido de factura", () => {
    const v = getStatusVisual("factura", "Pagada");
    expect(v.label).toBe("Pagada");
    expect(v.badgeClass).toBeTruthy();
  });

  it("hace fallback seguro para estados desconocidos", () => {
    const v = getStatusVisual("factura", "Inexistente");
    expect(v.label).toBe("Inexistente");
    expect(v.badgeClass).toContain("border");
  });

  it("devuelve neutral para vacío", () => {
    const v = getStatusVisual("factura", "");
    expect(v.label).toBe("—");
  });

  it("expone estados por dominio", () => {
    expect(DOMAIN_STATUSES.embarque).toContain("EIR");
    expect(DOMAIN_STATUSES.proforma).toContain("Aceptada");
  });
});

describe("<StatusBadge />", () => {
  it("renderiza dominio y estado como data attributes", () => {
    render(<StatusBadge domain="factura" status="Pagada" />);
    const el = screen.getByText("Pagada").closest("span[data-domain]");
    expect(el).toBeTruthy();
    expect(el?.getAttribute("data-domain")).toBe("factura");
    expect(el?.getAttribute("data-status")).toBe("Pagada");
  });

  it("acepta label override", () => {
    render(<StatusBadge domain="factura" status="Pagada" label="Cobrada" />);
    expect(screen.getByText("Cobrada")).toBeInTheDocument();
  });
});
