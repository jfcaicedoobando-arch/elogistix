/**
 * v13.819.3 — Captura de factura de proveedor: el cierre (Cancelar / X /
 * Escape / clic exterior) pasa por la confirmación canónica de
 * `FormDialogShell` cuando hay captura real, y al descartar el wizard queda
 * limpio para la siguiente apertura.
 *
 * Se prueba el cableado de cierre con un arnés equivalente al del diálogo real
 * (shell + footer + reset del controller), sin montar toda la cadena de datos.
 */
import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { CapturaFacturaFooter } from "../CapturaFacturaFooter";
import { conceptosConDatos, hayCapturaFactura } from "../_sections/capturaDerivados";
import type { CapturaPasos } from "@/features/cxp/hooks/useCapturaFacturaPasos";

const reset = vi.fn();
const onOpenChange = vi.fn();

function pasos(paso: 1 | 3 = 1): CapturaPasos {
  return {
    paso, totalPasos: 3, etiquetas: ["Documento", "Datos", "Vinculación"],
    esUltimo: paso === 3, esPrimero: paso === 1,
    irA: vi.fn(), siguiente: vi.fn(), anterior: vi.fn(),
    pendientesPorPaso: { documento: [], datos: [], vinculacion: [] },
    pendientesDeOtrosPasos: [],
  };
}

/** Arnés con el mismo cableado de cierre que `DialogNuevaFacturaProveedor`. */
function Arnes({ hayCaptura, paso = 1 }: { hayCaptura: boolean; paso?: 1 | 3 }) {
  const [open, setOpen] = useState(true);
  const cerrar = (o: boolean) => {
    if (!o) reset();
    setOpen(o);
    onOpenChange(o);
  };
  const cerrarYLimpiar = () => cerrar(false);
  return (
    <FormDialogShell
      open={open}
      onOpenChange={cerrar}
      icon={FileSpreadsheet}
      title="Capturar factura de proveedor"
      size="5xl"
      isDirty={hayCaptura}
      footer={
        <CapturaFacturaFooter
          pasos={pasos(paso)}
          guardando={false}
          puedeGuardar
          onCancelar={cerrarYLimpiar}
          // Guardado exitoso: el controller resetea y cierra sin pasar por el
          // shell, igual que `submit()` → `onDone` en el diálogo real.
          onGuardar={cerrarYLimpiar}
        />
      }
    >
      <p>cuerpo</p>
    </FormDialogShell>
  );
}

const confirmacion = () => screen.queryByText("¿Descartar los cambios?");

describe("cierre guardado de la captura de factura de proveedor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Cancelar con captura real pide confirmación y no cierra todavía", () => {
    render(<Arnes hayCaptura />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(confirmacion()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("Seguir capturando conserva la captura y el diálogo abierto", () => {
    render(<Arnes hayCaptura />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /seguir capturando/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(screen.getByText("cuerpo")).toBeInTheDocument();
  });

  it("Descartar cierra y resetea el wizard (siguiente apertura limpia)", () => {
    render(<Arnes hayCaptura />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("cuerpo")).toBeNull();
  });

  it("X con captura real pide confirmación", () => {
    render(<Arnes hayCaptura />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(confirmacion()).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("Escape con captura real pide confirmación", () => {
    render(<Arnes hayCaptura />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(confirmacion()).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("clic exterior con captura real pide confirmación", () => {
    render(<Arnes hayCaptura />);
    // En jsdom Radix cierra por `onPointerDownOutside`: el clic fuera del
    // contenido llega al body, que está fuera del diálogo.
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(confirmacion()).toBeInTheDocument();
  });

  it("sin cambios, Cancelar cierra directo y resetea (sin alerta)", () => {
    render(<Arnes hayCaptura={false} />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(confirmacion()).toBeNull();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sin cambios, Escape cierra directo sin alerta", () => {
    render(<Arnes hayCaptura={false} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(confirmacion()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("guardado exitoso", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tras guardar cierra y resetea sin mostrar la alerta de descarte", () => {
    render(<Arnes hayCaptura paso={3} />);
    fireEvent.click(screen.getByRole("button", { name: /guardar factura/i }));
    expect(confirmacion()).toBeNull();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("dirty de la captura", () => {
  it("un renglón recién agregado (vacío, en $0) no cuenta como captura", () => {
    const vacios = [{ descripcion: "", cantidad: 1, importe: 0 }];
    expect(conceptosConDatos(vacios)).toBe(0);
    expect(hayCapturaFactura({ subtotal: 0, conceptos: conceptosConDatos(vacios) })).toBe(false);
  });

  it("un concepto con descripción real sí cuenta como captura", () => {
    const conDatos = [
      { descripcion: "  ", cantidad: 1, importe: 0 },
      { descripcion: "Flete marítimo", cantidad: 1, importe: 0 },
    ];
    expect(conceptosConDatos(conDatos)).toBe(1);
    expect(hayCapturaFactura({ subtotal: 0, conceptos: conceptosConDatos(conDatos) })).toBe(true);
  });

  it("un concepto con importe capturado cuenta como captura", () => {
    expect(conceptosConDatos([{ descripcion: "", cantidad: 1, importe: 1500 }])).toBe(1);
  });
});
