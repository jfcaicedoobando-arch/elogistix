import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calcularKPIsComisiones } from "../devengadas";
import type { ComisionDevengada } from "../devengadas";

/**
 * KPIs puros — fechas mockeadas con vi.useFakeTimers para evitar flakiness
 * según el mes en que corra CI.
 */
const MES = "2026-06";
const FIJO = `${MES}-15T12:00:00.000Z`;

function row(p: Partial<ComisionDevengada> = {}): ComisionDevengada {
  return {
    id: p.id ?? "r1",
    organization_id: p.organization_id ?? "org-1",
    pago_factura_id: p.pago_factura_id ?? "pf-1",
    embarque_id: p.embarque_id ?? null,
    factura_id: p.factura_id ?? "f1",
    vendedora_id: p.vendedora_id ?? "v1",
    vendedora_nombre: p.vendedora_nombre ?? "V Uno",
    factura_numero: p.factura_numero ?? "F-001",
    cliente_nombre: p.cliente_nombre ?? "Cliente",
    expediente: p.expediente ?? null,
    monto_cobrado_mxn: p.monto_cobrado_mxn ?? 1000,
    utilidad_prorrateada_mxn: p.utilidad_prorrateada_mxn ?? 500,
    porcentaje_aplicado: p.porcentaje_aplicado ?? 5,
    comision_mxn: p.comision_mxn ?? 50,
    estado: p.estado ?? "Devengada",
    liquidacion_id: p.liquidacion_id ?? null,
    nota: p.nota ?? null,
    created_at: p.created_at ?? FIJO,
  };
}

describe("calcularKPIsComisiones", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIJO));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lista vacía → todos los KPIs en cero", () => {
    expect(calcularKPIsComisiones([])).toEqual({
      devengado_mes_mxn: 0,
      pendiente_liquidar_mxn: 0,
      liquidado_mes_mxn: 0,
      por_recuperar_mxn: 0,
    });
  });

  it("excluye estado Cancelada del devengado del mes", () => {
    const items = [
      row({ id: "a", comision_mxn: 100, estado: "Devengada" }),
      row({ id: "b", comision_mxn: 300, estado: "Cancelada" }),
    ];
    const k = calcularKPIsComisiones(items);
    expect(k.devengado_mes_mxn).toBe(100);
    expect(k.pendiente_liquidar_mxn).toBe(100);
  });

  it("soporta montos negativos (reversos/abonos)", () => {
    const items = [
      row({ id: "a", comision_mxn: 200, estado: "Devengada" }),
      row({ id: "b", comision_mxn: -50, estado: "Devengada" }),
    ];
    const k = calcularKPIsComisiones(items);
    expect(k.devengado_mes_mxn).toBe(150);
    expect(k.pendiente_liquidar_mxn).toBe(150);
  });

  it("mes distinto al actual no acumula devengado ni liquidado del mes", () => {
    const items = [
      row({ id: "a", comision_mxn: 400, estado: "Devengada", created_at: "2026-05-10T00:00:00.000Z" }),
      row({ id: "b", comision_mxn: 200, estado: "Liquidada", created_at: "2026-04-20T00:00:00.000Z" }),
    ];
    const k = calcularKPIsComisiones(items);
    expect(k.devengado_mes_mxn).toBe(0);
    expect(k.liquidado_mes_mxn).toBe(0);
    // Pendiente sí acumula porque no depende del mes.
    expect(k.pendiente_liquidar_mxn).toBe(400);
  });

  it("Liquidada en mes actual cuenta en liquidado_mes pero NO en pendiente", () => {
    const items = [
      row({ id: "a", comision_mxn: 800, estado: "Liquidada" }),
    ];
    const k = calcularKPIsComisiones(items);
    expect(k.liquidado_mes_mxn).toBe(800);
    expect(k.pendiente_liquidar_mxn).toBe(0);
    expect(k.devengado_mes_mxn).toBe(800); // Liquidada no es Cancelada → cuenta en devengado del mes.
  });
});
