/**
 * IVA explícito — la fila avisa "Tratamiento fiscal por definir" cuando no hay
 * clasificación, y en todos los demás casos muestra un selector con el
 * tratamiento SAT elegido (incluidos exento y no objeto, que ya se pueden
 * reclasificar sin volver a elegir el concepto del catálogo).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TratamientoIvaFila } from "@/features/cotizacion/components/conceptos/TratamientoIvaFila";
import { AVISO_TRATAMIENTO_POR_DEFINIR } from "@/features/cotizacion/components/conceptos/SelectTratamientoIvaFila";

vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => false,
}));

describe("TratamientoIvaFila (IVA explícito)", () => {
  it.each([[undefined], [null], ["desconocido"]])(
    "avisa 'por definir' cuando el tipo es %s",
    (tipoIva) => {
      render(
        <TratamientoIvaFila
          tipoIva={tipoIva as string | null | undefined}
          onTipoIvaChange={vi.fn()}
        />,
      );
      expect(screen.getByLabelText(AVISO_TRATAMIENTO_POR_DEFINIR)).toBeInTheDocument();
      expect(screen.queryByLabelText("Tratamiento de IVA")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["gravado_16", "16%"],
    ["gravado_8", "8%"],
    ["tasa_0", "0%"],
    ["exento", "Exento"],
    ["no_objeto", "No objeto"],
  ])("muestra el tratamiento %s como %s", (tipoIva, etiqueta) => {
    render(<TratamientoIvaFila tipoIva={tipoIva} onTipoIvaChange={vi.fn()} />);
    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveTextContent(etiqueta);
    expect(screen.queryByLabelText(AVISO_TRATAMIENTO_POR_DEFINIR)).not.toBeInTheDocument();
  });
});
