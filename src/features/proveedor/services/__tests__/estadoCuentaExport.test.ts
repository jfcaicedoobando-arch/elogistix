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
  it("neutraliza fórmulas y arma tres bloques", () => {
    const csv = estadoCuentaACsv(
      "HK LS Limited",
      "2026-01-01",
      "2026-01-31",
      filasMovimientosExport([movimiento]),
      filasSaldosExport([{ moneda: "usd", cargos: 1000, abonos: 0, saldo: 1000 }]),
    );
    expect(csv).toContain("Proveedor");
    expect(csv).toContain("Saldo del periodo");
    expect(csv).toContain("'=SUM(A1)");
    expect(csv.split("\n\n")).toHaveLength(3);
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
