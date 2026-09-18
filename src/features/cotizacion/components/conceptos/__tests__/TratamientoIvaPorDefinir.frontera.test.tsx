/**
 * P2-IVA (seguimiento) — el selector "por definir" no puede saltarse el
 * interruptor del estímulo fronterizo: con el 8% apagado la opción va
 * deshabilitada y el callback rechaza la selección aunque llegue de todos modos.
 *
 * Los primitivos de Radix se sustituyen por botones simples: en jsdom el
 * contenido del `Select` real no se despliega.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TratamientoIvaPorDefinir } from "@/features/cotizacion/components/conceptos/TratamientoIvaPorDefinir";
import { TIPO_IVA_LABEL_SAT } from "@/lib/financial/tipoIvaSat";

const estado = vi.hoisted(() => ({
  habilitada: false,
  onValueChange: null as ((v: string) => void) | null,
}));

vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => estado.habilitada,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (v: string) => void }) => {
    estado.onValueChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children, ...rest }: { children: React.ReactNode }) => (
    <button type="button" {...rest}>{children}</button>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => (
    <button
      type="button"
      data-testid={`opcion-${value}`}
      aria-disabled={disabled ? "true" : "false"}
      onClick={() => { if (!disabled) estado.onValueChange?.(value); }}
    >
      {children}
    </button>
  ),
}));

beforeEach(() => {
  estado.habilitada = false;
  estado.onValueChange = null;
});

describe("TratamientoIvaPorDefinir y el estímulo del 8%", () => {
  it("con el estímulo apagado la opción de 8% está deshabilitada y avisa por qué", () => {
    render(<TratamientoIvaPorDefinir onTipoIvaChange={vi.fn()} />);
    const opcion = screen.getByTestId("opcion-gravado_8");
    expect(opcion).toHaveAttribute("aria-disabled", "true");
    expect(opcion).toHaveTextContent(/deshabilitada/i);
    expect(opcion).toHaveTextContent(TIPO_IVA_LABEL_SAT.gravado_8);
  });

  it("con el estímulo apagado el callback rechaza el 8% aunque se fuerce la selección", () => {
    const onTipoIvaChange = vi.fn();
    render(<TratamientoIvaPorDefinir onTipoIvaChange={onTipoIvaChange} />);
    estado.onValueChange?.("gravado_8");
    expect(onTipoIvaChange).not.toHaveBeenCalled();
  });

  it("con el estímulo habilitado sí se puede elegir el 8%", () => {
    estado.habilitada = true;
    const onTipoIvaChange = vi.fn();
    render(<TratamientoIvaPorDefinir onTipoIvaChange={onTipoIvaChange} />);
    const opcion = screen.getByTestId("opcion-gravado_8");
    expect(opcion).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(opcion);
    expect(onTipoIvaChange).toHaveBeenCalledWith("gravado_8");
  });

  it("los demás tratamientos se eligen con el estímulo apagado", () => {
    const onTipoIvaChange = vi.fn();
    render(<TratamientoIvaPorDefinir onTipoIvaChange={onTipoIvaChange} />);
    fireEvent.click(screen.getByTestId("opcion-no_objeto"));
    expect(onTipoIvaChange).toHaveBeenCalledWith("no_objeto");
  });
});
