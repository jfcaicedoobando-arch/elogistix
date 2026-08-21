/**
 * Footer del wizard de captura: Continuar en los pasos 1-2 y Guardar en el 3.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CapturaFacturaFooter } from "../CapturaFacturaFooter";
import type { CapturaPasos } from "@/features/cxp/hooks/useCapturaFacturaPasos";

function pasosMock(paso: 1 | 2 | 3, extra: Partial<CapturaPasos> = {}): CapturaPasos {
  return {
    paso,
    totalPasos: 3,
    etiquetas: ["Documento", "Datos", "Vinculación"],
    esUltimo: paso === 3,
    esPrimero: paso === 1,
    irA: vi.fn(),
    siguiente: vi.fn(),
    anterior: vi.fn(),
    pendientesPorPaso: { documento: [], datos: [], vinculacion: [] },
    pendientesDeOtrosPasos: [],
    ...extra,
  };
}

const base = {
  guardando: false,
  puedeGuardar: true,
  onCancelar: vi.fn(),
  onGuardar: vi.fn(),
};

describe("CapturaFacturaFooter", () => {
  it("en el paso 1 muestra Continuar y esconde Guardar y Atrás", () => {
    render(<CapturaFacturaFooter pasos={pasosMock(1)} {...base} />);
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar factura/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /atrás/i })).toBeNull();
  });

  it("en el paso 3 muestra Guardar factura y llama al handler", () => {
    const onGuardar = vi.fn();
    render(<CapturaFacturaFooter pasos={pasosMock(3)} {...base} onGuardar={onGuardar} />);
    expect(screen.queryByRole("button", { name: /continuar/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /guardar factura/i }));
    expect(onGuardar).toHaveBeenCalled();
  });

  it("los pendientes de otros pasos saltan a ese paso", () => {
    const irA = vi.fn();
    const pasos = pasosMock(1, {
      irA,
      pendientesDeOtrosPasos: [{ paso: 2, texto: "Falta el proveedor" }],
    });
    render(<CapturaFacturaFooter pasos={pasos} {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /falta el proveedor/i }));
    expect(irA).toHaveBeenCalledWith(2);
  });
});
