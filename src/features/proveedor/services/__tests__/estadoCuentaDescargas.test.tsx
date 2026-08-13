import { describe, it, expect, beforeEach, vi } from "vitest";

const descargarBlob = vi.fn();
const notifyWarning = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("@/lib/downloadBlob", () => ({ descargarBlob }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning, notifySuccess, notifyError }));

import {
  descargarEstadoCuentaCsv,
  type DatosEstadoCuenta,
} from "@/features/proveedor/services/estadoCuentaDescargas";
import type { MovimientoConSaldo } from "@/features/proveedor/domain/movimientosProveedor";

const movimiento: MovimientoConSaldo = {
  fecha: "2026-01-10",
  tipo: "Factura",
  ref_id: "f1",
  folio: "FP-000001",
  referencia: null,
  expediente: "ELIMP00001",
  embarque_id: null,
  moneda: "USD",
  cargo: 1000,
  abono: 0,
  detalle: null,
  saldo: 1000,
};

const datos = (movs: MovimientoConSaldo[]): DatosEstadoCuenta => ({
  proveedorNombre: "HK LS Limited",
  rfc: "TE25126564",
  desde: "2026-01-01",
  hasta: "2026-01-31",
  movimientos: movs,
  aging: [],
  saldos: [{ moneda: "USD", cargos: 1000, abonos: 0, saldo: 1000 }],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("descargarEstadoCuentaCsv", () => {
  it("avisa y no descarga cuando el periodo no tiene movimientos", () => {
    descargarEstadoCuentaCsv(datos([]));
    expect(descargarBlob).not.toHaveBeenCalled();
    expect(notifyWarning).toHaveBeenCalled();
  });

  it("descarga un CSV con BOM y nombre de archivo derivado del proveedor", () => {
    descargarEstadoCuentaCsv(datos([movimiento]));
    expect(descargarBlob).toHaveBeenCalledTimes(1);
    const [blob, nombre] = descargarBlob.mock.calls[0];
    expect(nombre).toBe("estado-cuenta-hk-ls-limited-2026-01-31.csv");
    expect(blob.type).toContain("text/csv");
    expect(notifySuccess).toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("reporta el error sin lanzar si falla la descarga", () => {
    descargarBlob.mockImplementationOnce(() => {
      throw new Error("sin permiso");
    });
    expect(() => descargarEstadoCuentaCsv(datos([movimiento]))).not.toThrow();
    expect(notifyError).toHaveBeenCalled();
  });
});
