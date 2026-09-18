/**
 * P2-IVA (seguimiento) — el selector "por definir" no puede saltarse el
 * interruptor del estímulo fronterizo: con el 8% apagado la opción va
 * deshabilitada y el callback rechaza la selección.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TratamientoIvaPorDefinir } from "@/features/cotizacion/components/conceptos/TratamientoIvaPorDefinir";
import { TIPO_IVA_LABEL_SAT } from "@/lib/financial/tipoIvaSat";

const habilitada = vi.hoisted(() => ({ valor: false }));
vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => habilitada.valor,
}));

beforeEach(() => {
  habilitada.valor = false;
});

async function abrirOpciones() {
  await userEvent.click(screen.getByRole("combobox"));
}

describe("TratamientoIvaPorDefinir y el estímulo del 8%", () => {
  it("con el estímulo apagado la opción de 8% está deshabilitada", async () => {
    render(<TratamientoIvaPorDefinir onTipoIvaChange={vi.fn()} />);
    await abrirOpciones();
    const opcion = screen.getByRole("option", { name: new RegExp(TIPO_IVA_LABEL_SAT.gravado_8, "i") });
    expect(opcion).toHaveAttribute("aria-disabled", "true");
  });

  it("con el estímulo habilitado la opción de 8% se puede elegir", async () => {
    habilitada.valor = true;
    const onTipoIvaChange = vi.fn();
    render(<TratamientoIvaPorDefinir onTipoIvaChange={onTipoIvaChange} />);
    await abrirOpciones();
    await userEvent.click(
      screen.getByRole("option", { name: new RegExp(TIPO_IVA_LABEL_SAT.gravado_8, "i") }),
    );
    expect(onTipoIvaChange).toHaveBeenCalledWith("gravado_8");
  });

  it("otros tratamientos siempre se pueden elegir con el estímulo apagado", async () => {
    const onTipoIvaChange = vi.fn();
    render(<TratamientoIvaPorDefinir onTipoIvaChange={onTipoIvaChange} />);
    await abrirOpciones();
    await userEvent.click(
      screen.getByRole("option", { name: new RegExp(TIPO_IVA_LABEL_SAT.no_objeto, "i") }),
    );
    expect(onTipoIvaChange).toHaveBeenCalledWith("no_objeto");
  });
});
