/**
 * v13.823.396 · Q2/Q6/Q7 — el Paso 2 no avanza con filas vacías ni con costos
 * automáticos desactualizados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { filaCostoConImporte, validarPaso2 } from "@/features/cotizacion/hooks/wizard/paso2Helpers";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
}));

function fila(over: Partial<FilaCostoLocal> = {}): FilaCostoLocal {
  return {
    concepto: "Flete marítimo",
    moneda: "USD",
    proveedor: "ACME",
    cantidad: 1,
    costo_unitario: 1000,
    precio_venta: 1150,
    notas: "",
    ...over,
  } as FilaCostoLocal;
}

const vacia = () =>
  fila({ concepto: "", proveedor: "", cantidad: 0, costo_unitario: 0, precio_venta: 0 });

beforeEach(() => notifyError.mockClear());

describe("Q7 · una fila vacía no cuenta como costo", () => {
  it("filaCostoConImporte descarta la fila vacía", () => {
    expect(filaCostoConImporte(vacia())).toBe(false);
    expect(filaCostoConImporte(fila())).toBe(true);
  });

  it("bloquea el paso cuando sólo hay filas vacías", () => {
    expect(validarPaso2([vacia(), vacia()])).toBe(false);
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: COPY_VALIDACION.costosInternosSinImporte }),
    );
  });

  it("permite avanzar si hay al menos una fila válida junto a las vacías", () => {
    expect(validarPaso2([fila(), vacia()])).toBe(true);
    expect(notifyError).not.toHaveBeenCalled();
  });
});

describe("Q2/Q6 · costos automáticos desactualizados bloquean el avance", () => {
  it("bloquea por cantidad de contenedores desalineada", () => {
    expect(validarPaso2([fila()], "tarifa_cantidad")).toBe(false);
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: COPY_VALIDACION.costosTarifaDesactualizados }),
    );
  });

  it("bloquea por flete LCL obsoleto", () => {
    expect(validarPaso2([fila()], "flete_lcl")).toBe(false);
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: COPY_VALIDACION.costosFleteLclDesactualizado }),
    );
  });

  it("avanza cuando no hay desajuste", () => {
    expect(validarPaso2([fila()], null)).toBe(true);
  });
});
