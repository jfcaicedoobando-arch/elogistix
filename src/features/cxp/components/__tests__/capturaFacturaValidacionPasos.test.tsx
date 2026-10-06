import { useState } from "react";
import { MemoryRouter } from "react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CapturaFacturaPasosBody } from "../_sections/CapturaFacturaPasosBody";
import { CapturaFacturaFooter } from "../CapturaFacturaFooter";
import { pendientesDeCaptura } from "../pendientesDeCaptura";
import { useCapturaFacturaPasos } from "../../hooks/useCapturaFacturaPasos";
import { initialValues, validateFactura } from "../../hooks/useNuevaFacturaProveedorForm.helpers";
import type { FacturaFormValues } from "../../types";

// Aislamiento explícito: cualquier I/O no previsto falla localmente, nunca usa .env.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => { throw new Error("Supabase I/O no simulado en este test"); }),
    rpc: vi.fn(() => { throw new Error("Supabase RPC no simulado en este test"); }) },
}));

vi.mock("../_sections/PasoDocumento", () => ({ PasoDocumento: () => <p>Documento conservado</p> }));
vi.mock("../_sections/PasoVinculacion", () => ({ PasoVinculacion: () => <p tabIndex={0}>Revisión final</p> }));
vi.mock("../ProveedorCombobox", () => ({
  ProveedorCombobox: ({ value, id }: { value: string; id: string }) => <input id={id} value={value} readOnly />,
}));
const guardar = vi.fn();
type BodyProps = Parameters<typeof CapturaFacturaPasosBody>[0];

function Harness() {
  const [values, setValues] = useState({ ...initialValues(), provId: "p1", provNombre: "Proveedor",
    folio: "ALM-041026-01", subtotal: "1", categoriaId: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FacturaFormValues, string>>>({});
  const validarDatos = () => {
    const next = validateFactura(values, 1);
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const pasos = useCapturaFacturaPasos({ abierto: true,
    pendientes: pendientesDeCaptura({ values, total: 1 }), validarDatos });
  const ctl: BodyProps["ctl"] = { values, errors, total: 1, puedeGuardar: true, submit: guardar,
    handleChange: (key, value) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }, handleProveedor: vi.fn(),
    totalesManuales: { visible: false, propuesta: null, difiere: false, puedeAplicar: false, aplicar: vi.fn() },
    mode: "manual", setMode: vi.fn(), pendingCfdi: null, cfdiConceptos: [],
    askCrearProv: null, setAskCrearProv: vi.fn(), editarConceptoIa: vi.fn(), eliminarConceptoIa: vi.fn(),
    handleCfdiParsed: vi.fn().mockResolvedValue(true), handlePdfIaParsed: vi.fn().mockResolvedValue(true),
    vinculos: {}, toggleVinculo: vi.fn(), setVinculoMonto: vi.fn(), aplicarSugerencias: vi.fn(), limpiarVinculos: vi.fn(),
    conceptosManuales: { conceptos: [], agregar: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn(),
      duplicar: vi.fn(), ajustarDiferencia: vi.fn(), limpiar: vi.fn(), reemplazar: vi.fn() },
    cuadreManual: { suma: 1, diferencia: 0, estado: "cuadrado", puedeAprobar: true },
    cfdiDuplicado: null, topeVinculacion: { asignado: 0, disponible: 1, excedente: 0, excede: false, lineas: 0 },
    embarqueAdHoc: null, setEmbarqueAdHoc: vi.fn(), reset: vi.fn(), validate: validarDatos,
    isPending: false, organizationId: "org", tcOrigen: "vacio", tcFechaAplicada: undefined,
    obtenerDofManual: vi.fn(), dofLoading: false,
  };
  return <MemoryRouter><TooltipProvider>
    <output aria-label="Paso activo">{pasos.paso}</output>
    <CapturaFacturaPasosBody ctl={ctl} pasos={pasos} categorias={[{ id: "cat1", nombre: "Administración" }]}
      entrante={null} autocarga={{} as BodyProps["autocarga"]} categoriaCogs={null}
      herencia={null} keyRenglonSospechoso={null} modoBuzon={false} onCerrar={vi.fn()} />
    <CapturaFacturaFooter pasos={pasos} guardando={false} puedeGuardar onCancelar={vi.fn()}
      onGuardar={() => { if (pasos.revisarDatos()) guardar(); }} />
    <button onClick={() => pasos.irA(3)}>Saltar a revisión</button>
    <button onClick={() => ctl.handleChange("categoriaId", "cat1")}>Elegir Administración</button>
  </TooltipProvider></MemoryRouter>;
}

beforeEach(() => vi.clearAllMocks());
const paso = (n: number) => expect(screen.getByLabelText("Paso activo")).toHaveTextContent(String(n));
const categoria = () => screen.getByRole("combobox", { name: "Categoría contable" });

describe("captura · errores visibles sin perder datos", () => {
  it("el pendiente de categoría del paso 1 lleva al selector visible y enfocado", async () => {
    render(<Harness />);
    paso(1);
    fireEvent.click(screen.getByRole("button", { name: /Falta la categoría contable/ }));
    paso(2);
    await waitFor(() => expect(categoria()).toHaveFocus());
    expect(categoria()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/categoría/i);
    expect(screen.getByLabelText(/Folio del proveedor/)).toHaveValue("ALM-041026-01");
  });

  it("Continuar valida el paso 2, conserva lo capturado y permite avanzar al corregir", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    paso(2);
    await waitFor(() => expect(categoria()).toHaveFocus());
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.keyDown(categoria(), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Administración" }));
    expect(categoria()).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    paso(3);
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByLabelText(/Folio del proveedor/)).toHaveValue("ALM-041026-01");
    expect(categoria()).toHaveTextContent("Administración");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar factura" }));
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it.each(["ctrlKey", "metaKey"])("%s+Enter comparte validación al continuar y guardar", async (modifier) => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByText("Documento conservado"), { key: "Enter", [modifier]: true });
    paso(2);
    fireEvent.keyDown(categoria(), { key: "Enter", [modifier]: true });
    await waitFor(() => expect(categoria()).toHaveFocus());
    paso(2);
    fireEvent.click(screen.getByRole("button", { name: "Saltar a revisión" }));
    paso(3);
    fireEvent.keyDown(screen.getByText("Revisión final"), { key: "Enter", [modifier]: true });
    paso(2);
    await waitFor(() => expect(categoria()).toHaveFocus());
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Subtotal")).toHaveValue("1");
  });

  it("Guardar desde el paso 3 regresa al campo requerido sin depender del toast", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Saltar a revisión" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar factura" }));
    paso(2);
    await waitFor(() => expect(categoria()).toHaveFocus());
    expect(guardar).not.toHaveBeenCalled();
  });
});
