/**
 * R170-08: la cantidad de un concepto no debe sustituirse silenciosamente
 * (0/vacío → 1) ni perder el punto decimal al teclear.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormRow } from "../FacturaConceptosEditorRows";
import type { ConceptoFacturaInput } from "@/features/facturacion/services/conceptosFacturaCrud";

const EMPTY: ConceptoFacturaInput = {
  descripcion: "Servicio de flete",
  cantidad: 1,
  precio_unitario: 100,
  clave_sat: "78101800",
  tipo_iva: "gravado_16",
  tasa_ret_isr: 0,
  tasa_ret_iva: 0,
};

function setup(initial: ConceptoFacturaInput = EMPTY) {
  let draft = initial;
  const setDraft = vi.fn((d: ConceptoFacturaInput) => { draft = d; });
  const onSave = vi.fn();
  const utils = render(
    <FormRow draft={draft} setDraft={setDraft} onCancel={vi.fn()} onSave={onSave} busy={false} />,
  );
  return { ...utils, setDraft, onSave, getDraft: () => draft };
}

describe("FormRow — cantidad", () => {
  it("cantidad 0 bloquea el guardado", () => {
    setup({ ...EMPTY, cantidad: 0 });
    expect(screen.getByLabelText("Guardar")).toBeDisabled();
    expect(screen.getByText("La cantidad debe ser mayor a cero")).toBeInTheDocument();
  });

  it("campo vacío no se convierte en 1", () => {
    const { setDraft } = setup();
    const input = screen.getByLabelText("Cantidad");
    fireEvent.change(input, { target: { value: "" } });
    expect(setDraft).toHaveBeenLastCalledWith(expect.objectContaining({ cantidad: 0 }));
  });

  it('tecleo carácter a carácter "1.5" queda 1.5', () => {
    const { setDraft } = setup({ ...EMPTY, cantidad: 0 });
    const input = screen.getByLabelText("Cantidad");
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "1." } });
    fireEvent.change(input, { target: { value: "1.5" } });
    expect(setDraft).toHaveBeenLastCalledWith(expect.objectContaining({ cantidad: 1.5 }));
  });

  it("entero 1 sigue funcionando y permite guardar", () => {
    setup({ ...EMPTY, cantidad: 1 });
    expect(screen.getByLabelText("Guardar")).not.toBeDisabled();
  });
});
