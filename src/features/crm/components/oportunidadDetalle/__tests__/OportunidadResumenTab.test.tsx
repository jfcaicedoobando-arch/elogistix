/**
 * v13.823.103 — OportunidadResumenTab: fechas y monto meta se formatean
 * con los formateadores canónicos y no se muestra ISO ni número crudo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OportunidadResumenTab } from "@/features/crm/components/oportunidadDetalle/OportunidadResumenTab";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

const fieldsByLabel = new Map<string, string | null>();

vi.mock("@/features/crm/components/OportunidadCotizacionesList", () => ({
  default: () => <div data-testid="cotizaciones-list" />,
}));
vi.mock("../CriteriosSalidaCard", () => ({
  CriteriosSalidaCard: () => <div data-testid="criterios-salida" />,
}));
vi.mock("../DatosComercialesCard", () => ({
  DatosComercialesCard: ({ fields }: { fields: { label: string; value?: string | null }[] }) => {
    fields.forEach((f) => fieldsByLabel.set(f.label, f.value ?? null));
    return <div data-testid="datos-comerciales" />;
  },
}));
vi.mock("../MargenAutorizacionCard", () => ({
  MargenAutorizacionCard: () => <div data-testid="margen-autorizacion" />,
}));

const baseOp: Partial<CrmOportunidadRow> = {
  id: "op-1",
  vendedor_email: "vendedor@example.com",
  modo: "marítimo",
  origen: "Shanghai",
  destino: "Manzanillo",
  monto_meta: 50000,
  moneda: "MXN",
  compromiso_nota: "Compromiso firmado",
  notas: "Nota de prueba",
  etapa_id: "etapa-1",
  margen_pct: null,
  margen_autorizado_at: null,
  riesgos_objeciones: null,
};

describe("OportunidadResumenTab", () => {
  it("formatea fechas y monto meta sin mostrar ISO ni número crudo", () => {
    fieldsByLabel.clear();
    const op = {
      ...baseOp,
      fecha_estimada_cierre: "2026-09-15T10:30:00Z",
      fecha_meta_cierre: "2026-09-20",
    } as CrmOportunidadRow;

    render(<OportunidadResumenTab op={op} etapaNombre="Calificado" canEdit={false} />);
    expect(screen.getByTestId("datos-comerciales")).toBeInTheDocument();

    const estimada = fieldsByLabel.get("Cierre estimado");
    const meta = fieldsByLabel.get("Fecha meta de cierre");
    const monto = fieldsByLabel.get("Monto meta");

    expect(estimada).toBe("15/09/2026");
    expect(estimada).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(meta).toBe("20/09/2026");
    expect(meta).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(monto).toMatch(/^MXN/);
    expect(monto).not.toContain("50000");
  });

  it("muestra — cuando fechas y monto meta son nulos", () => {
    fieldsByLabel.clear();
    const op = {
      ...baseOp,
      fecha_estimada_cierre: null,
      fecha_meta_cierre: null,
      monto_meta: null,
    } as CrmOportunidadRow;

    render(<OportunidadResumenTab op={op} etapaNombre="Calificado" canEdit={false} />);

    expect(fieldsByLabel.get("Cierre estimado")).toBe("—");
    expect(fieldsByLabel.get("Fecha meta de cierre")).toBe("—");
    // Monto meta nulo se deja para el fallback de DatosComercialesCard (—).
    expect(fieldsByLabel.get("Monto meta")).toBeNull();
  });
});
