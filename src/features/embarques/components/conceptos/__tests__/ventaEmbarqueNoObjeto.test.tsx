/**
 * SAT 01 — "Ventas de embarques": elegir un producto "No objeto de impuesto"
 * en el catálogo debe conservar el tratamiento fiscal hasta el payload que se
 * manda al RPC, sin degradarlo a "Exento" ni tomar la tasa global.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buildConceptosVentaPayload } from "@/features/embarques/domain/mappers/embarqueToDbConceptos";
import { ivaDeFila } from "@/features/embarques/domain/ivaConceptoVenta";
import { resolverTasaConcepto } from "@/lib/financial/financialUtils";
import type { ConceptoVentaLocal } from "@/types/concepto";

vi.mock("@/features/embarques/components/conceptos/ConceptoCatalogoSelect", () => ({
  ConceptoCatalogoSelect: ({
    onChange,
    onSelectFiscal,
  }: {
    onChange: (v: string) => void;
    onSelectFiscal?: (f: { aplicaIva: boolean; tasaIva: number; tipoIva?: string | null }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange("Maniobras SAT 01");
        onSelectFiscal?.({ aplicaIva: false, tasaIva: 0, tipoIva: "no_objeto" });
      }}
    >
      elegir producto
    </button>
  ),
}));

import { FilaVentaPrecio } from "@/features/embarques/components/conceptos/FilaVentaPrecio";

const FILA_BASE: ConceptoVentaLocal = {
  id: 1,
  concepto: "",
  cantidad: 2,
  precioUnitario: 100,
  moneda: "MXN",
  contenedorId: null,
};

describe("Ventas de embarques — producto no objeto (SAT 01)", () => {
  it("al elegir el producto guarda tipoIva en la fila y llega al payload", async () => {
    let fila: ConceptoVentaLocal = { ...FILA_BASE };
    const update = vi.fn((_id: number, field: string, value: unknown) => {
      fila = { ...fila, [field]: value } as ConceptoVentaLocal;
    });

    render(
      <FilaVentaPrecio
        venta={fila}
        totalUSD={200}
        esMixta={false}
        cols="grid-cols-6"
        showContenedorCol={false}
        tcUSD={17}
        disableRemove
        update={update}
        remove={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "elegir producto" }));

    expect(fila.tipoIva).toBe("no_objeto");
    expect(fila.aplicaIva).toBe(false);
    expect(fila.tasaIva).toBe(0);

    const [payload] = buildConceptosVentaPayload([fila]);
    expect(payload.tipo_iva).toBe("no_objeto");
    expect(payload.aplica_iva).toBe(false);
    expect(payload.total).toBe(200);
  });

  it("no objeto no causa IVA ni toma la tasa global, y no es 'exento' inferido", () => {
    const filaDb = { aplica_iva: false, tasa_iva_aplicada: null, tipo_iva: "no_objeto" };
    expect(ivaDeFila(filaDb)).toBe(false);
    expect(resolverTasaConcepto(filaDb, 0.16)).toBe(0);
    // Aunque llegue un flag incoherente, el tipo explícito manda.
    expect(resolverTasaConcepto({ aplica_iva: true, tipo_iva: "no_objeto" }, 0.16)).toBe(0);
  });

  it("una fila legacy sin tipoIva no envía la clave (conserva lo guardado)", () => {
    const [payload] = buildConceptosVentaPayload([
      { ...FILA_BASE, concepto: "Flete", aplicaIva: true, tasaIva: 0.16 },
    ]);
    expect("tipo_iva" in payload).toBe(false);
    expect(resolverTasaConcepto({ aplica_iva: true, tasa_iva_aplicada: null }, 0.16)).toBe(0.16);
  });
});
