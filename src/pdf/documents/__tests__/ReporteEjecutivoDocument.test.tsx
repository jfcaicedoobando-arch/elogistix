import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ReporteEjecutivoDocument } from "../ReporteEjecutivoDocument";
import type { SnapshotEjecutivo } from "@/features/dashboard/services-ejecutivo";

const mockSnapshot = {
  periodo: "2023-01",
  generadoEn: "2023-01-01T10:00:00Z",
  kpis: {
    ingresos_mxn: 1_000_000,
    ingresos_delta_pct: 0,
    utilidad_mxn: 250_000,
    margen_pct: 25,
    saldo_bancos_mxn: 500_000,
    cartera_vencida_mxn: 0,
    cartera_vencida_count: 0,
    cxp_7dias_mxn: 0,
    cumplimiento_presupuesto_pct: 0,
  },
  eerrPeriodo: {} as SnapshotEjecutivo["eerrPeriodo"],
  eerr12m: [],
  tesoreria: { cuentas: [] } as unknown as SnapshotEjecutivo["tesoreria"],
  flujo: {} as SnapshotEjecutivo["flujo"],
  presupuesto: {} as SnapshotEjecutivo["presupuesto"],
  topDeudores: [],
  topAcreedores: [],
  alertas: [],
} satisfies SnapshotEjecutivo;

afterEach(() => { cleanup(); });

describe("ReporteEjecutivoDocument", () => {
  it("muestra título, período, KPIs y mensajes de listas vacías", () => {
    const { container } = render(<ReporteEjecutivoDocument snapshot={mockSnapshot} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Dashboard Ejecutivo");
    expect(text).toContain("2023-01");
    expect(text).toContain("Top deudores");
    expect(text).toContain("Top acreedores");
    expect(text).toContain("Sin cuentas activas");
    expect(text).toContain("Sin cartera vencida");
    expect(text).toContain("25.0%");
  });

  it("renderiza nombre de deudor cuando hay topDeudores", () => {
    const snapshot: SnapshotEjecutivo = {
      ...mockSnapshot,
      topDeudores: [{ nombre: "Deudor Importante", saldo: 1234, moneda: "USD" } as any],
    };
    const { container } = render(<ReporteEjecutivoDocument snapshot={snapshot} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Deudor Importante");
    expect(text).not.toContain("Sin cartera vencida");
  });
});
