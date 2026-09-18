/**
 * P1 · Auditoría IVA — el 8% de región fronteriza no debe poder capturarse en
 * la factura cuando el estímulo está deshabilitado (antes sólo se bloqueaba al
 * timbrar). Un renglón que YA venía al 8% sí se puede seguir editando.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormRow } from "../FacturaConceptosEditorRows";
import { frontera8Bloqueado } from "../facturaTipoIva";
import { AVISO_IVA_FRONTERA_DESHABILITADO } from "@/lib/financial/ivaFrontera";
import type { ConceptoFacturaInput } from "@/features/facturacion/services/conceptosFacturaCrud";

const habilitada = vi.fn((): boolean => false);
vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => habilitada(),
}));

const BASE: ConceptoFacturaInput = {
  descripcion: "Flete marítimo",
  cantidad: 1,
  precio_unitario: 1000,
  clave_sat: "78101800",
  tipo_iva: "gravado_16",
  tasa_ret_isr: 0,
  tasa_ret_iva: 0,
};

function renderRow(draft: ConceptoFacturaInput, tipoOriginal?: "gravado_8" | null) {
  return render(
    <FormRow
      draft={draft}
      setDraft={vi.fn()}
      onCancel={vi.fn()}
      onSave={vi.fn()}
      busy={false}
      tipoOriginal={tipoOriginal}
    />,
  );
}

describe("frontera8Bloqueado", () => {
  it("bloquea el 8% nuevo con el estímulo apagado", () => {
    expect(frontera8Bloqueado("gravado_8", null, false)).toBe(true);
  });
  it("permite el 8% con el estímulo encendido", () => {
    expect(frontera8Bloqueado("gravado_8", null, true)).toBe(false);
  });
  it("respeta un renglón histórico que ya venía al 8%", () => {
    expect(frontera8Bloqueado("gravado_8", "gravado_8", false)).toBe(false);
  });
  it("no bloquea los demás tratamientos ni el pendiente", () => {
    expect(frontera8Bloqueado("gravado_16", null, false)).toBe(false);
    expect(frontera8Bloqueado("tasa_0", null, false)).toBe(false);
    expect(frontera8Bloqueado(undefined, null, false)).toBe(false);
  });
});

describe("FormRow — estímulo de 8% deshabilitado", () => {
  beforeEach(() => { habilitada.mockReturnValue(false); });

  it("alta nueva al 8%: avisa y no permite guardar", () => {
    renderRow({ ...BASE, tipo_iva: "gravado_8" }, null);
    expect(screen.getByText(AVISO_IVA_FRONTERA_DESHABILITADO)).toBeInTheDocument();
    expect(screen.getByLabelText("Guardar")).toBeDisabled();
  });

  it("edición de un renglón histórico al 8%: se puede guardar", () => {
    renderRow({ ...BASE, tipo_iva: "gravado_8" }, "gravado_8");
    expect(screen.queryByText(AVISO_IVA_FRONTERA_DESHABILITADO)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Guardar")).not.toBeDisabled();
  });

  it("16% sigue capturable con el estímulo apagado", () => {
    renderRow(BASE, null);
    expect(screen.queryByText(AVISO_IVA_FRONTERA_DESHABILITADO)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Guardar")).not.toBeDisabled();
  });

  it("con el estímulo encendido el 8% nuevo sí se puede guardar", () => {
    habilitada.mockReturnValue(true);
    renderRow({ ...BASE, tipo_iva: "gravado_8" }, null);
    expect(screen.queryByText(AVISO_IVA_FRONTERA_DESHABILITADO)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Guardar")).not.toBeDisabled();
  });
});
