import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { descargarEstadoCuentaPdf } from "../estadoCuentaDescargas";

const h = vi.hoisted(() => ({ descargarPdf: vi.fn(), notifySuccess: vi.fn() }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: h.descargarPdf }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorEntidad: async () => ({ organizacionNombre: "Operación sintética" }) }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: h.notifySuccess, notifyWarning: vi.fn(), notifyError: vi.fn(),
}));

describe("Descarga PDF proveedor: contrato74", () => {
  it("transporta apertura, saldo global y truncado sin reemplazarlos por el saldo del último movimiento", async () => {
    await descargarEstadoCuentaPdf({
      proveedorId: "proveedor-sintetico", proveedorNombre: "Proveedor sintético", desde: "2026-10-01", hasta: "2026-10-03",
      movimientos: [{ fecha: "2026-10-03", tipo: "Factura", ref_id: "f1", folio: "FP-12",
        referencia: null, expediente: "", embarque_id: null, moneda: "MXN", cargo: 3,
        abono: 0, detalle: null, saldo: 4146.1 }], aging: [],
      saldos: [{ moneda: "MXN", cargos: 4149.1, abonos: 0, saldo: 4149.1 }],
      saldoApertura: [{ moneda: "MXN", saldo: 4143.1 }], hayMas: true, totalMovimientos: 501,
    });
    const document = h.descargarPdf.mock.calls[0][0] as ReactElement<{
      saldos: { saldo: string }[]; saldoApertura: { saldo: string }[];
      movimientos: { saldo: string }[]; hayMas: boolean; totalMovimientos: number;
    }>;
    expect(document.props.saldos[0].saldo).toBe("4149.10");
    expect(document.props.saldoApertura[0].saldo).toBe("4143.1");
    expect(document.props.movimientos[0].saldo).toBe("4146.10");
    expect(document.props.hayMas).toBe(true);
    expect(document.props.totalMovimientos).toBe(501);
    expect(h.notifySuccess).toHaveBeenCalled();
  });
});
