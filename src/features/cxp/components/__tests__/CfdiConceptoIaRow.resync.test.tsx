/**
 * v13.823.33: al borrar un renglón de conceptos extraídos por IA, React reutiliza
 * la instancia del renglón que pasa a ocupar el mismo índice. Antes los recuadros
 * de cantidad, importe e IVA conservaban los valores del renglón eliminado.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableBody } from "@/components/ui/table";
import { CfdiConceptoIaRow } from "../CfdiConceptoIaRow";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import type { LineaConceptoResumen } from "@/features/cxp/utils/resumenConceptos";

function linea(cantidad: number, monto: number, iva: number): LineaConceptoResumen {
  return { cantidad, monto, iva, ieps: 0, retenciones: 0 } as unknown as LineaConceptoResumen;
}

function concepto(descripcion: string): CfdiConceptoParsed {
  return { descripcion } as unknown as CfdiConceptoParsed;
}

function renderRow(c: CfdiConceptoParsed, l: LineaConceptoResumen) {
  return render(
    <Table>
      <TableBody>
        <CfdiConceptoIaRow
          indice={0}
          concepto={c}
          linea={l}
          moneda="MXN"
          hayIeps={false}
          onEditar={vi.fn()}
          onEliminar={vi.fn()}
        />
      </TableBody>
    </Table>,
  );
}

describe("CfdiConceptoIaRow · resincronización tras eliminar", () => {
  it("actualiza cantidad, importe e IVA cuando el renglón del índice cambia", () => {
    const { rerender } = renderRow(concepto("Flete"), linea(2, 1000, 160));

    expect((screen.getByLabelText("Cantidad del concepto 1") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("Importe unitario del concepto 1") as HTMLInputElement).value).toBe("1000.00");
    expect((screen.getByLabelText("IVA del concepto 1") as HTMLInputElement).value).toBe("160.00");

    // Se borró el renglón anterior: ahora el índice 0 es otro concepto.
    rerender(
      <Table>
        <TableBody>
          <CfdiConceptoIaRow
            indice={0}
            concepto={concepto("Maniobras")}
            linea={linea(1, 250, 40)}
            moneda="MXN"
            hayIeps={false}
            onEditar={vi.fn()}
            onEliminar={vi.fn()}
          />
        </TableBody>
      </Table>,
    );

    expect((screen.getByLabelText("Cantidad del concepto 1") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Importe unitario del concepto 1") as HTMLInputElement).value).toBe("250.00");
    expect((screen.getByLabelText("IVA del concepto 1") as HTMLInputElement).value).toBe("40.00");
  });
});
