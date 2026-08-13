import { describe, expect, it } from "vitest";
import {
  estadoCuentaACsv,
  filasAgingExport,
  filasMovimientosExport,
  filasSaldosExport,
  nombreArchivoEstadoCuenta,
} from "@/features/proveedor/services/estadoCuentaExport";
import type {
  AgingMonedaProveedor,
  MovimientoConSaldo,
} from "@/features/proveedor/domain/movimientosProveedor";

const movimiento: MovimientoConSaldo = {
  fecha: "2026-01-10T00:00:00Z",
  tipo: "Factura",
  ref_id: "f1",
  folio: "FP-000001",
  referencia: "=SUM(A1)",
  expediente: "ELIMP00001",
  embarque_id: null,
  moneda: "usd",
  cargo: 1000.005,
  abono: 0,
  detalle: null,
  saldo: 1000.01,
};

describe("filasMovimientosExport", () => {
  it("normaliza fecha, moneda y montos a dos decimales", () => {
    const [fila] = filasMovimientosExport([movimiento]);
    expect(fila.fecha).toBe("2026-01-10");
    expect(fila.moneda).toBe("USD");
    expect(fila.cargo).toBe("1000.01");
    expect(fila.abono).toBe("0.00");
  });
});

describe("filasAgingExport", () => {
  it("emite las cinco cubetas por moneda", () => {
    const aging: AgingMonedaProveedor[] = [
      {
        moneda: "MXN",
        buckets: { Vigente: 100, "1-30": 0, "31-60": 50, "61-90": 0, "90+": 0 },
        conteo: 2,
        total: 150,
        vencido: 50,
      },
    ];
    const filas = filasAgingExport(aging);
    expect(filas).toHaveLength(5);
    expect(filas[0]).toEqual({ moneda: "MXN", etiqueta: "Por vencer", saldo: "100.00" });
  });
});

describe("estadoCuentaACsv", () => {
  it("neutraliza fórmulas y arma cuatro bloques", () => {
    const csv = estadoCuentaACsv(
      "HK LS Limited",
      "2026-01-01",
      "2026-01-31",
      filasMovimientosExport([movimiento]),
      filasSaldosExport([{ moneda: "usd", cargos: 1000, abonos: 0, saldo: 1000 }]),
      filasAgingExport([
        {
          moneda: "USD",
          buckets: { Vigente: 0, "1-30": 600, "31-60": 0, "61-90": 0, "90+": 0 },
          conteo: 1,
          total: 600,
          vencido: 600,
        },
      ]),
    );
    expect(csv).toContain("Proveedor");
    expect(csv).toContain("Saldo global");
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("Antigüedad");
    expect(csv.split("\n\n")).toHaveLength(4);
  });

  it("soporta estado de cuenta sólo-antigüedad (sin movimientos)", () => {
    const csv = estadoCuentaACsv(
      "HK LS Limited",
      "2026-01-01",
      "2026-01-31",
      [],
      [],
      filasAgingExport([
        {
          moneda: "MXN",
          buckets: { Vigente: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 5000 },
          conteo: 1,
          total: 5000,
          vencido: 5000,
        },
      ]),
    );
    expect(csv).toContain("5000.00");
  });
});

describe("nombreArchivoEstadoCuenta", () => {
  it("genera un nombre seguro con acentos normalizados", () => {
    expect(nombreArchivoEstadoCuenta("Logística Ñandú S.A.", "2026-01-31", "pdf")).toBe(
      "estado-cuenta-logistica-nandu-s-a-2026-01-31.pdf",
    );
  });

  it("usa un nombre por defecto si el proveedor no tiene texto útil", () => {
    expect(nombreArchivoEstadoCuenta("###", "2026-01-31", "csv")).toBe(
      "estado-cuenta-proveedor-2026-01-31.csv",
    );
  });
});
