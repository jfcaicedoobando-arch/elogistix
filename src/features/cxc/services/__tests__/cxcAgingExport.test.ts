/**
 * Tests de `exportarCxcAgingCsv`: nombre de archivo por moneda/fecha, columnas
 * del CSV y manejo del caso sin filas (warning en vez de descarga).
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { exportarCxcAgingCsv } from "@/features/cxc/services/cxcAgingExport";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
}));

function fila(overrides: Partial<CxcAgingRow> = {}): CxcAgingRow {
  return {
    cliente_id: "c1",
    cliente_nombre: "Cliente Uno",
    moneda: "MXN",
    saldo_total: 1000,
    vigente: 400,
    d_1_30: 300,
    d_31_60: 200,
    d_61_90: 100,
    mas_90: 0,
    num_facturas: 4,
    ...overrides,
  };
}

describe("exportarCxcAgingCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (URL.createObjectURL as unknown) = vi.fn(() => "blob:mock-url");
    (URL.revokeObjectURL as unknown) = vi.fn();
  });

  it("genera el nombre de archivo con la moneda y la fecha activas", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const anchor = document.createElement("a");
    const createElSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportarCxcAgingCsv([fila()], "USD", "2026-08-09");

    expect(anchor.download).toBe("aging-cxc-USD-2026-08-09.csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    createElSpy.mockRestore();
  });

  it("incluye encabezados y una línea con los datos de cada cliente", () => {
    let csvGenerado = "";
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        void this;
      });
    // Interceptamos el Blob para inspeccionar el CSV real generado.
    const OriginalBlob = globalThis.Blob;
    // @ts-expect-error -- espiamos el contenido pasado al Blob en el test
    globalThis.Blob = class extends OriginalBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        csvGenerado = String(parts[0]);
      }
    };

    exportarCxcAgingCsv(
      [fila({ cliente_nombre: 'Cliente "Dos"', moneda: "MXN" })],
      "MXN",
      "2026-08-09",
    );

    const lineas = csvGenerado.split("\n");
    expect(lineas[0]).toBe(
      "Cliente,Moneda,Facturas,Vigente,1-30,31-60,61-90,+90,Total",
    );
    expect(lineas[1]).toContain('"Cliente ""Dos"""');
    expect(lineas[1]).toContain("MXN");
    expect(lineas[1]).toContain("1000");

    globalThis.Blob = OriginalBlob;
    clickSpy.mockRestore();
  });

  it("no descarga y muestra advertencia cuando no hay filas", () => {
    exportarCxcAgingCsv([], "MXN", "2026-08-09");
    expect(notifyWarning).toHaveBeenCalledWith(undefined, {
      title: "Sin datos para exportar",
      description: "No hay saldos de clientes para exportar con los filtros actuales.",
    });
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("notifica éxito con el conteo de filas cuando sí hay datos", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    exportarCxcAgingCsv([fila(), fila({ cliente_id: "c2" })], "MXN", "2026-08-09");
    expect(notifySuccess).toHaveBeenCalledWith(undefined, {
      title: "CSV descargado",
      description: "aging-cxc-MXN-2026-08-09.csv · 2 fila(s)",
    });
  });
});
