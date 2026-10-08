import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ReporteEjecutivoDocument } from "../ReporteEjecutivoDocument";
import type { SnapshotEjecutivo } from "@/features/dashboardEjecutivo/services";

const mockSnapshot = {
  periodo: "2023-01",
  fuente: "embarques",
  vencimientos: {
    fechaReferencia: "2023-01-01",
    cobranzaMayor30: { total_mxn: 0, count: 0, top: [], excluido_por_moneda: {} },
    cxpProximos7: { total_mxn: 0, count: 0, top: [], excluido_por_moneda: {} },
  },
  generadoEn: "2023-01-01T10:00:00Z",
  kpis: {
    ingresos_mxn: 1_000_000,
    ingresos_delta_pct: 0,
    utilidad_mxn: 250_000,
    utilidad_delta_pct: null,
    margen_pct: 25,
    margen_delta_puntos: null,
    saldo_bancos_mxn: 500_000,
    cartera_vencida_mxn: 0,
    cartera_vencida_count: 0,
    cxp_7dias_mxn: 0,
    cumplimiento_presupuesto_pct: 0,
    categorias_en_exceso: 0,
    dso_dias: null,
    dpo_dias: null,
    runway_meses: null,
  },
  eerrPeriodo: {} as SnapshotEjecutivo["eerrPeriodo"],
  eerr12m: [],
  tesoreria: { cuentas: [] } as unknown as SnapshotEjecutivo["tesoreria"],
  flujo: {} as SnapshotEjecutivo["flujo"],
  presupuesto: {} as SnapshotEjecutivo["presupuesto"],
  topDeudores: [],
  topAcreedores: [],
  alertas: [],
  tipoCambioUsd: 18.5,
  tcEsFallback: false,
} satisfies SnapshotEjecutivo;

// `cleanup()` ya lo ejecuta `src/test/setup.ts` globalmente — sin override local
// (auditoría 13.137.30 - BAJA: limpieza redundante eliminada).


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
    expect(text).toContain("Fuente EERR: Embarques (operativa)");
    expect(text).toContain("cuya ETA cae en el periodo");
    expect(text).toContain("Bancos y cartera al 2023-01-01");
  });

  it("identifica fuente Facturas y su criterio fiscal sin cambiar los KPIs", () => {
    const snapshot: SnapshotEjecutivo = { ...mockSnapshot, fuente: "facturas", tcEsFallback: true };
    const { container } = render(<ReporteEjecutivoDocument snapshot={snapshot} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Fuente EERR: Facturas (devengada)");
    expect(text).toContain("Bases sin IVA");
    expect(text).toContain("facturas por fecha fiscal");
    expect(text).toContain("notas de crédito vigentes por emisión");
    expect(text).toContain("respaldo estimado, sólo referencia");
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

  it("conserva moneda original de bancos y muestra emisor configurado sin logo", () => {
    const snapshot: SnapshotEjecutivo = {
      ...mockSnapshot,
      tesoreria: {
        ...mockSnapshot.tesoreria,
        cuentas: [{ id: "cuenta-eur", alias: "Operativa EUR", banco: "Banco sintético", moneda: "EUR", saldo: 1234.56 }],
      },
    };
    const { container, queryByTestId } = render(<ReporteEjecutivoDocument snapshot={snapshot}
      emisor={{ razonSocial: "Operadora Sintética SA", rfc: "AAA010101AAA" }} />);
    expect(container).toHaveTextContent("Operadora Sintética SA");
    expect(container).toHaveTextContent("Operativa EUR — Banco sintético");
    expect(container).toHaveTextContent("EUR 1,234.56");
    expect(container).not.toHaveTextContent("Sin cuentas activas");
    expect(queryByTestId("pdf-image")).not.toBeInTheDocument();
  });
});
