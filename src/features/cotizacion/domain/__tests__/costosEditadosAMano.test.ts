/**
 * Regresión QA: editar a mano una fila auto-generada NO debe bloquear el Paso 2
 * ni exponerla al recálculo destructivo.
 */
import { describe, it, expect } from "vitest";
import {
  NOTA_AUTO_TARIFA,
  NOTA_AUTO_FLETE_LCL,
  marcarEditadaAMano,
  esCostoAutoGenerado,
  desajusteCantidadTarifa,
  fleteLclDesactualizado,
  reemplazarCostosAutoTarifa,
} from "@/features/cotizacion/domain/costosAutoGenerados";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

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

describe("marcarEditadaAMano", () => {
  it("quita la marca automática de una fila de tarifa", () => {
    const editada = marcarEditadaAMano(fila({ notas: NOTA_AUTO_TARIFA, cantidad: 3 }));
    expect(esCostoAutoGenerado(editada)).toBe(false);
    expect(editada.notas).toContain(NOTA_AUTO_TARIFA);
  });

  it("no toca una fila capturada a mano", () => {
    const manual = fila({ notas: "Capturado a mano" });
    expect(marcarEditadaAMano(manual)).toBe(manual);
  });

  it("una fila de tarifa editada ya no genera desajuste de cantidad", () => {
    const editada = marcarEditadaAMano(fila({ notas: NOTA_AUTO_TARIFA, cantidad: 3 }));
    expect(desajusteCantidadTarifa([editada], 1)).toBe(false);
  });

  it("una fila LCL editada ya no se marca como desactualizada", () => {
    const auto = fila({ notas: `${NOTA_AUTO_FLETE_LCL} — W/M 3 @ $45`, costo_unitario: 135 });
    const editada = marcarEditadaAMano({ ...auto, costo_unitario: 180 });
    expect(fleteLclDesactualizado([editada], [auto])).toBe(false);
  });

  it("el recálculo de tarifa conserva la fila editada a mano", () => {
    const editada = marcarEditadaAMano(fila({ notas: NOTA_AUTO_TARIFA, costo_unitario: 900 }));
    const resultado = reemplazarCostosAutoTarifa([editada], [fila({ notas: NOTA_AUTO_TARIFA })]);
    expect(resultado).toHaveLength(2);
    expect(resultado.some((f) => f.costo_unitario === 900)).toBe(true);
  });
});
