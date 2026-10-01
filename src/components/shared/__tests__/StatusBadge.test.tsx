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

  it.each([
    ["tarifa_maritima", "Vigente", "bg-info/15", "border-info/30"],
    ["factura", "Pendiente", "bg-warning/15", "border-warning/30"],
    ["factura_cxp", "Validado", "bg-success/15", "border-success/30"],
    ["cotizacion", "Rechazada", "bg-destructive/15", "border-destructive/30"],
    ["lead", "Convertido", "bg-primary/15", "border-primary/30"],
    ["factura", "Pagada", "bg-muted", "border-border"],
  ] as const)("usa texto legible sin perder el tono de %s/%s", (domain, status, background, border) => {
    render(<StatusBadge domain={domain} status={status} />);
    const badge = screen.getByText(status).closest("span[data-domain]");
    expect(badge).toHaveClass("text-foreground", background, border);
    const visual = getStatusVisual(domain, status);
    for (const colorClass of visual.badgeClass.split(" ").filter((value) => value.startsWith("text-"))) {
      expect(badge).not.toHaveClass(colorClass);
    }
    expect(badge).toHaveAttribute("data-status", status);
  });

  it("conserva las personalizaciones explícitas de texto del consumidor", () => {
    render(<StatusBadge domain="factura" status="Pagada" className="text-muted-foreground" />);
    const badge = screen.getByText("Pagada").closest("span[data-domain]");
    expect(badge).toHaveClass("text-muted-foreground");
    expect(badge).not.toHaveClass("text-foreground");
  });
});

