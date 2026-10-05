import { describe, expect, it, vi } from "vitest";
import type { CobranzaRow, CxpRow } from "@/features/tesoreria/domain";
import { calcularVencimientosEjecutivos } from "../vencimientos";

const hoy = new Date(2026, 9, 4, 18, 15);
const cobranza = (id: string, fecha: string, saldo = 58): CobranzaRow => ({
  id, numero: id, cliente_nombre: id, moneda: "MXN", saldo,
  fecha_vencimiento: fecha, estatus_cobranza: "Vencida", dias_vencido: 1,
});
const cxp = (id: string, fecha: string | null, saldo = 95): CxpRow => ({
  id, folio_proveedor: id, proveedor_nombre: id, moneda: "MXN", saldo,
  fecha_vencimiento: fecha, estatus: "Pendiente", dias_vencido: 99,
});

describe("ventanas de vencimiento del dashboard (79/81)", () => {
  it("cobra sólo saldo vencido hace más de 30 días, usando fecha y canon financiero", () => {
    const res = calcularVencimientosEjecutivos({ hoy, cxp: [], cobranza: [
      cobranza("un día", "2026-10-03"), cobranza("30 días", "2026-09-04"),
      cobranza("31 días", "2026-09-03"), cobranza("pagada", "2026-08-01", 0),
      { ...cobranza("cancelada", "2026-08-01"), estatus_cobranza: "Cancelada" },
    ] });
    expect(res.fechaReferencia).toBe("2026-10-04");
    expect(res.cobranzaMayor30).toMatchObject({ total_mxn: 58, count: 1 });
    expect(res.cobranzaMayor30.top).toEqual([{ nombre: "31 días", saldo: 58, moneda: "MXN", dias: 31 }]);
  });

  it("ancla la ventana al día de negocio de México cuando UTC ya cambió de día", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-05T01:00:00Z"));
      const res = calcularVencimientosEjecutivos({ cobranza: [], cxp: [cxp("hoy MX", "2026-10-04")] });
      expect(res.fechaReferencia).toBe("2026-10-04");
      expect(res.cxpProximos7.top[0]?.dias).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("conserva el total completo y cuenta clientes únicos aunque Top5 trunque", () => {
    const rows = Array.from({ length: 7 }, (_, i) => cobranza(`cliente${i}`, "2026-09-01", 10));
    rows.push({ ...cobranza("otra factura", "2026-08-01", 20), cliente_nombre: "cliente0" });
    const res = calcularVencimientosEjecutivos({ hoy, cobranza: rows, cxp: [] });
    expect(res.cobranzaMayor30).toMatchObject({ total_mxn: 90, count: 7 });
    expect(res.cobranzaMayor30.top).toHaveLength(5);
    expect(res.cobranzaMayor30.top[0]).toMatchObject({ nombre: "cliente0", saldo: 30, dias: 64 });
  });

  it("CxP incluye hoy y día7, excluye vencidos, día8, saldo0 y fecha faltante", () => {
    const rows = [
      cxp("8 días vencida", "2026-09-26"), cxp("un día vencida", "2026-10-03"),
      cxp("hoy", "2026-10-04", 1), cxp("mañana", "2026-10-05", 2),
      cxp("día7", "2026-10-11", 3), cxp("día8", "2026-10-12"),
      cxp("pagada", "2026-10-04", 0), cxp("sin fecha", null),
      { ...cxp("programada", "2026-10-12"), fecha_programada_pago: "2026-10-05" },
    ];
    const res = calcularVencimientosEjecutivos({ hoy, cobranza: [], cxp: rows });
    expect(res.cxpProximos7).toMatchObject({ total_mxn: 6, count: 3 });
    expect(res.cxpProximos7.top.map((r) => [r.nombre, r.dias])).toEqual([
      ["día7", -7], ["mañana", -1], ["hoy", 0],
    ]);
  });

  it("convierte los dos KPIs con el canon de moneda sin simular TC faltante", () => {
    const res = calcularVencimientosEjecutivos({ hoy, tasas: { usdMxn: 20 },
      cobranza: [{ ...cobranza("USD", "2026-09-01", 10), moneda: "USD" }],
      cxp: [{ ...cxp("USD", "2026-10-05", 10), moneda: "USD" },
        { ...cxp("EUR", "2026-10-05", 20), moneda: "EUR" }],
    });
    expect(res.cobranzaMayor30.total_mxn).toBe(200);
    expect(res.cxpProximos7.total_mxn).toBe(200);
    expect(res.cxpProximos7.excluido_por_moneda).toEqual({ EUR: 20 });
    expect(res.cxpProximos7.top).toContainEqual({ nombre: "EUR", saldo: 20, moneda: "EUR", dias: -1 });
  });
});
