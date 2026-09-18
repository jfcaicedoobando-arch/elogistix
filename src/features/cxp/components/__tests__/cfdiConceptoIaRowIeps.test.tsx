/**
 * P2 · Auditoría IVA — el IEPS extraído por IA era sólo texto y no se podía
 * corregir. Ahora es un campo editable con el mismo patrón accesible del IVA.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Table, TableBody } from "@/components/ui/table";
import { CfdiConceptoIaRow } from "../CfdiConceptoIaRow";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import type { LineaConceptoResumen } from "@/features/cxp/utils/resumenConceptos";

const linea = { cantidad: 1, monto: 1000, iva: 160, ieps: 40 } as unknown as LineaConceptoResumen;
const concepto = { descripcion: "Combustible" } as unknown as CfdiConceptoParsed;

function renderRow(onEditar = vi.fn()) {
  render(
    <Table>
      <TableBody>
        <CfdiConceptoIaRow
          indice={0}
          concepto={concepto}
          linea={linea}
          moneda="MXN"
          hayIeps
          onEditar={onEditar}
          onEliminar={vi.fn()}
        />
      </TableBody>
    </Table>,
  );
  return onEditar;
}

describe("CfdiConceptoIaRow · IEPS editable", () => {
  it("muestra el IEPS extraído en un campo con etiqueta accesible", () => {
    renderRow();
    const input = screen.getByLabelText("IEPS del concepto 1") as HTMLInputElement;
    expect(input.value).toBe("40.00");
  });

  it("propaga la corrección del IEPS para recalcular totales", () => {
    const onEditar = renderRow();
    const input = screen.getByLabelText("IEPS del concepto 1");
    fireEvent.change(input, { target: { value: "55.5" } });
    expect(onEditar).toHaveBeenCalledWith({ ieps: 55.5 });
  });
});
