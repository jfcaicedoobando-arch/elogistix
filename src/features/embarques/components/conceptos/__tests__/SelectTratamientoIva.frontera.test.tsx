import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SelectTratamientoIva } from "../SelectTratamientoIva";
import { cambioDesdeTipoIva } from "@/features/embarques/domain/cambioTratamientoIva";
import { AVISO_IVA_FRONTERA_DESHABILITADO } from "@/lib/financial/ivaFrontera";
import { TIPO_IVA_OPCIONES } from "@/lib/financial/tipoIvaSat";

const estado = vi.hoisted(() => ({
  habilitada: false,
  elegir: null as ((valor: string) => void) | null,
}));

vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => estado.habilitada,
}));

// Los eventos de Radix se prueban con botones; el diálogo de confirmación es real.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (v: string) => void }) => {
    estado.elegir = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
  SelectValue: ({ children, placeholder }: { children: ReactNode; placeholder?: string }) => <span>{children ?? placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value, disabled }: { children: ReactNode; value: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled} data-testid={`opcion-${value}`}
      onClick={() => estado.elegir?.(value)}>{children}</button>
  ),
}));

beforeEach(() => {
  estado.habilitada = false;
  estado.elegir = null;
});

describe("IVA fronterizo en ventas de embarque", () => {
  it("deshabilita el 8% y explica cómo habilitarlo", () => {
    render(<SelectTratamientoIva onChange={vi.fn()} />);
    expect(screen.getByTestId("opcion-gravado_8")).toBeDisabled();
    expect(screen.getByTestId("opcion-gravado_8")).toHaveTextContent(AVISO_IVA_FRONTERA_DESHABILITADO);
  });

  it("rechaza el callback forzado con el estímulo apagado", () => {
    const onChange = vi.fn();
    render(<SelectTratamientoIva onChange={onChange} />);
    act(() => estado.elegir?.("gravado_8"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("con estímulo activo sólo aplica el 8% después de confirmar", () => {
    estado.habilitada = true;
    const onChange = vi.fn();
    render(<SelectTratamientoIva onChange={onChange} />);
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmo la elegibilidad" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(cambioDesdeTipoIva("gravado_8"));
  });

  it("cancelar la confirmación conserva el tratamiento anterior", () => {
    estado.habilitada = true;
    const onChange = vi.fn();
    render(<SelectTratamientoIva tipoIva="no_objeto" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveTextContent("IVA: No objeto");
  });

  it("revalida la configuración cuando cambia con la confirmación abierta", () => {
    estado.habilitada = true;
    const onChange = vi.fn();
    const { rerender } = render(<SelectTratamientoIva onChange={onChange} />);
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    estado.habilitada = false;
    rerender(<SelectTratamientoIva onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmo la elegibilidad" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("una fila bloqueada no acepta cambios ni confirmaciones tardías", () => {
    estado.habilitada = true;
    const onChange = vi.fn();
    const { rerender } = render(<SelectTratamientoIva onChange={onChange} />);
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    rerender(<SelectTratamientoIva disabled onChange={onChange} />);
    act(() => estado.elegir?.("gravado_16"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmo la elegibilidad" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra el 8% histórico sin reclasificarlo ni disparar onChange", () => {
    const onChange = vi.fn();
    render(<SelectTratamientoIva tipoIva="gravado_8" aplicaIva tasaIva={0.08} onChange={onChange} />);
    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveTextContent("IVA: 8%");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("los otros cuatro tratamientos siguen proyectando tipo, tasa y aplicaIva", () => {
    const onChange = vi.fn();
    render(<SelectTratamientoIva onChange={onChange} />);
    for (const opcion of TIPO_IVA_OPCIONES.filter((o) => o.value !== "gravado_8")) {
      fireEvent.click(screen.getByTestId(`opcion-${opcion.value}`));
      expect(onChange).toHaveBeenLastCalledWith(cambioDesdeTipoIva(opcion.value));
    }
    expect(onChange).toHaveBeenCalledTimes(4);
    act(() => estado.elegir?.("desconocido"));
    expect(onChange).toHaveBeenCalledTimes(4);
  });
});
