/**
 * IVA explícito — el selector de tratamiento no puede saltarse el interruptor
 * del estímulo fronterizo: con el 8% apagado la opción va deshabilitada y el
 * callback rechaza la selección aunque llegue de todos modos. Con el estímulo
 * activo, elegir 8% exige confirmación explícita.
 *
 * Los primitivos de Radix se sustituyen por botones simples: en jsdom el
 * contenido del `Select` real no se despliega.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AVISO_TRATAMIENTO_POR_DEFINIR,
  SelectTratamientoIvaFila,
} from "@/features/cotizacion/components/conceptos/SelectTratamientoIvaFila";
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
  SelectItem: ({ children, value, disabled, className }: { children: React.ReactNode; value: string; disabled?: boolean; className?: string }) => (
    <button
      type="button"
      data-testid={`opcion-${value}`}
      aria-disabled={disabled ? "true" : "false"}
      className={className}
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

describe("SelectTratamientoIvaFila y el estímulo del 8%", () => {
  it("con el estímulo apagado la opción de 8% está deshabilitada y avisa por qué", () => {
    render(<SelectTratamientoIvaFila onTipoIvaChange={vi.fn()} />);
    const opcion = screen.getByTestId("opcion-gravado_8");
    expect(opcion).toHaveAttribute("aria-disabled", "true");
    expect(opcion).toHaveTextContent(/deshabilitada/i);
    expect(opcion).toHaveTextContent(TIPO_IVA_LABEL_SAT.gravado_8);
    expect(opcion.className).toContain("data-[disabled]:text-muted-foreground");
    expect(screen.getByLabelText(AVISO_TRATAMIENTO_POR_DEFINIR)).toHaveClass("text-foreground");
  });

  it("con el estímulo apagado el callback rechaza el 8% aunque se fuerce la selección", () => {
    const onTipoIvaChange = vi.fn();
    render(<SelectTratamientoIvaFila onTipoIvaChange={onTipoIvaChange} />);
    estado.onValueChange?.("gravado_8");
    expect(onTipoIvaChange).not.toHaveBeenCalled();
  });

  it("con el estímulo habilitado el 8% exige confirmación explícita", () => {
    estado.habilitada = true;
    const onTipoIvaChange = vi.fn();
    render(<SelectTratamientoIvaFila onTipoIvaChange={onTipoIvaChange} />);
    const opcion = screen.getByTestId("opcion-gravado_8");
    expect(opcion).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(opcion);
    expect(onTipoIvaChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmo la elegibilidad"));
    expect(onTipoIvaChange).toHaveBeenCalledWith("gravado_8");
  });

  it("los demás tratamientos se eligen con el estímulo apagado", () => {
    const onTipoIvaChange = vi.fn();
    render(<SelectTratamientoIvaFila onTipoIvaChange={onTipoIvaChange} />);
    fireEvent.click(screen.getByTestId("opcion-no_objeto"));
    expect(onTipoIvaChange).toHaveBeenCalledWith("no_objeto");
  });

  it("una línea ya clasificada muestra su tratamiento y puede reclasificarse", () => {
    const onTipoIvaChange = vi.fn();
    render(<SelectTratamientoIvaFila tipoIva="exento" onTipoIvaChange={onTipoIvaChange} />);
    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveTextContent("Exento");
    fireEvent.click(screen.getByTestId("opcion-tasa_0"));
    expect(onTipoIvaChange).toHaveBeenCalledWith("tasa_0");
  });
});
