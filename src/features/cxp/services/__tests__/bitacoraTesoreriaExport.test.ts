/**
 * Pruebas de la exportación (CSV/PDF) de la bitácora de tesorería.
 */
import { describe, expect, it } from "vitest";
import {
  ENCABEZADOS_BITACORA_EXPORT,
  bitacoraExportACsv,
  filasBitacoraExport,
  nombreArchivoBitacora,
} from "@/features/cxp/services/bitacoraTesoreriaExport";
import { descripcionFiltrosBitacora } from "@/features/cxp/services/bitacoraTesoreriaFiltros";

const nombreCuenta = new Map([["c1", "BBVA · Operativa (MXN)"]]);

const entradas = [
  {
    accion: "pagar",
    created_at: "2026-08-01T15:30:00Z",
    usuario_email: "ana@lc.com",
    detalles: {
      monto: 1160,
      moneda: "MXN",
      cuenta_bancaria_id: "c1",
      movimiento_tesoreria: "creado",
    },
  },
  {
    accion: "eliminar_pago",
    created_at: "2026-08-02T10:00:00Z",
    usuario_email: "beto@lc.com",
    detalles: { monto: 100, moneda: "USD", cargo_mxn: 1850, movimiento_tesoreria: "dado_de_baja" },
  },
  { accion: "editar_pago", created_at: "2026-08-03T09:00:00Z", usuario_email: "", detalles: null },
];

describe("filasBitacoraExport", () => {
  const filas = filasBitacoraExport(entradas, { monedaFactura: "MXN", nombreCuenta });

  it("traduce acciones a lenguaje de negocio", () => {
    expect(filas.map((f) => f.movimiento)).toEqual([
      "Pago registrado",
      "Pago eliminado",
      "Pago editado",
    ]);
  });

  it("resuelve el nombre de la cuenta bancaria", () => {
    expect(filas[0].cuenta).toBe("BBVA · Operativa (MXN)");
    expect(filas[1].cuenta).toBe("—");
  });

  it("traduce el estado del movimiento y usa guion cuando falta dato", () => {
    expect(filas[0].estadoMovimiento).toBe("Movimiento creado");
    expect(filas[1].estadoMovimiento).toBe("Movimiento dado de baja");
    expect(filas[2].estadoMovimiento).toBe("—");
    expect(filas[2].monto).toBe("—");
    expect(filas[2].usuario).toBe("—");
  });
});

describe("bitacoraExportACsv", () => {
  it("incluye encabezados y una línea por movimiento", () => {
    const filas = filasBitacoraExport(entradas, { monedaFactura: "MXN", nombreCuenta });
    const csv = bitacoraExportACsv(filas);
    const lineas = csv.split("\n");
    expect(lineas).toHaveLength(4);
    expect(lineas[0]).toContain(ENCABEZADOS_BITACORA_EXPORT[0]);
    expect(csv).toContain("Pago registrado");
    expect(csv).toContain("ana@lc.com");
  });

  it("no falla con lista vacía", () => {
    expect(bitacoraExportACsv([]).split("\n")).toHaveLength(1);
  });
});

describe("nombreArchivoBitacora", () => {
  it("normaliza el folio y agrega la fecha", () => {
    const fecha = new Date(2026, 7, 3);
    expect(nombreArchivoBitacora("FP-000123 Ñ", "csv", fecha)).toBe(
      "bitacora-tesoreria-fp-000123-n-2026-08-03.csv",
    );
    expect(nombreArchivoBitacora("", "pdf", fecha)).toBe(
      "bitacora-tesoreria-factura-2026-08-03.pdf",
    );
  });
});

describe("descripcionFiltrosBitacora", () => {
  it("describe el estado sin filtros", () => {
    expect(
      descripcionFiltrosBitacora({
        desde: "", hasta: "", tipo: "todos", usuario: "todos", orden: "reciente",
      }),
    ).toBe("Todos los movimientos · más reciente primero");
  });

  it("describe fechas en formato mexicano y filtros activos", () => {
    const d = descripcionFiltrosBitacora({
      desde: "2026-08-01",
      hasta: "2026-08-31",
      tipo: "eliminar_pago",
      usuario: "ana@lc.com",
      orden: "antiguo",
    });
    expect(d).toContain("desde 01/08/2026");
    expect(d).toContain("hasta 31/08/2026");
    expect(d).toContain("Pago eliminado");
    expect(d).toContain("usuario ana@lc.com");
  });
});
