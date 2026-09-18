/**
 * P2-IVA — la fila avisa "Tratamiento fiscal por definir" en vez de mostrar
 * una tasa como si la clasificación estuviera resuelta.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TratamientoIvaFila } from "@/features/cotizacion/components/conceptos/TratamientoIvaFila";
import { AVISO_TRATAMIENTO_POR_DEFINIR } from "@/features/cotizacion/components/conceptos/TratamientoIvaPorDefinir";

vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => false,
}));

describe("TratamientoIvaFila (P2-IVA)", () => {
  it.each([[undefined], [null], ["desconocido"]])(
    "avisa 'por definir' cuando el tipo es %s",
    (tipoIva) => {
      render(
        <TratamientoIvaFila
          tipoIva={tipoIva as string | null | undefined}
          tasa={0.16}
          onTasaChange={vi.fn()}
          onTipoIvaChange={vi.fn()}
        />,
      );
      expect(screen.getByLabelText(AVISO_TRATAMIENTO_POR_DEFINIR)).toBeInTheDocument();
      expect(screen.queryByLabelText("Tasa de IVA")).not.toBeInTheDocument();
    },
  );

  it("muestra el selector de tasa cuando el tratamiento sí está clasificado", () => {
    render(
      <TratamientoIvaFila tipoIva="gravado_16" tasa={0.16} onTasaChange={vi.fn()} onTipoIvaChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Tasa de IVA")).toBeInTheDocument();
    expect(screen.queryByLabelText(AVISO_TRATAMIENTO_POR_DEFINIR)).not.toBeInTheDocument();
  });

  it("una línea heredada al 8% se sigue mostrando al 8% aunque el estímulo esté deshabilitado", () => {
    render(
      <TratamientoIvaFila tipoIva="gravado_8" tasa={0.08} onTasaChange={vi.fn()} onTipoIvaChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Tasa de IVA")).toHaveTextContent("8%");
  });

  it("mantiene la etiqueta fija de los tratamientos sin tasa", () => {
    render(<TratamientoIvaFila tipoIva="no_objeto" tasa={0} onTasaChange={vi.fn()} />);
    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveValue("No objeto · SAT 01");
  });
});
