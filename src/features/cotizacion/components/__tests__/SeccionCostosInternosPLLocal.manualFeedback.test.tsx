import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeccionCostosInternosPLLocal from "../SeccionCostosInternosPLLocal";
import { NOTA_AUTO_FLETE_LCL, NOTA_AUTO_TARIFA, reemplazarCostosAutoTarifa } from "@/features/cotizacion/domain/costosAutoGenerados";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { CostosAutoSync } from "@/features/cotizacion/hooks/wizard/useCostosAutoSync";

const sincronizar = vi.fn<() => CostosAutoSync>();
vi.mock("@/features/costeo", () => ({ destinoDe: vi.fn(), origenDe: vi.fn(), etiquetaRutaCompleta: () => "Ruta ficticia" }));
vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: () => <span>Flete ficticio</span>,
}));
vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <span>Servicio</span>,
}));
const base: FilaCostoLocal = { concepto: "Flete ficticio", proveedor: "Proveedor ficticio", moneda: "USD", cantidad: 1,
  costo_unitario: 100, precio_venta: 150, unidad_medida: "E48", aplica_iva: false,
  notas: NOTA_AUTO_TARIFA, costeo_tarifa_id: "tarifa-ficticia", costeo_tarifa_recargo_id: "recargo-ficticio" };
function Fixture({ inicial = base }: { inicial?: FilaCostoLocal }) {
  const [filas, setFilas] = useState([inicial]);
  return <><SeccionCostosInternosPLLocal filas={filas} setFilas={setFilas} sincronizacion={sincronizar()} />
    <button onClick={() => setFilas(prev => reemplazarCostosAutoTarifa(prev, []))}>Recalcular precargas ficticias</button>
    <output aria-label="Estado de filas">{JSON.stringify(filas)}</output></>;
}
function filasActuales(): FilaCostoLocal[] { return JSON.parse(screen.getByLabelText("Estado de filas").textContent ?? "[]"); }
beforeEach(() => sincronizar.mockReturnValue({ tarifa: undefined, mostrarAvisoLclFcl: false,
  lclAutoCargado: false, desajuste: null, recalculando: false, recalcular: vi.fn(), conservarManuales: vi.fn(),
  errorCargaTarifa: false, reintentarCargaTarifa: vi.fn(), cargarTarifaElegida: vi.fn() }));

describe("H08 · consecuencias visibles de editar precargas", () => {
  it("muestra el fallo de precarga y permite reintentar sin editar los costos", () => {
    const reintentarCargaTarifa = vi.fn();
    sincronizar.mockReturnValueOnce({ ...sincronizar(), errorCargaTarifa: true, reintentarCargaTarifa });
    render(<Fixture />);
    expect(screen.getByText("No se pudieron cargar los costos de la tarifa.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reintentarCargaTarifa).toHaveBeenCalledOnce();
    expect(filasActuales()).toEqual([base]);
  });

  it.each([NOTA_AUTO_TARIFA, `${NOTA_AUTO_FLETE_LCL} — W/M ficticio`])("advierte y muestra la fila manual sin abrir notas (%s)", notas => {
    render(<Fixture inicial={{ ...base, notas }} />);
    expect(screen.getByText(/Si editas el concepto, proveedor, moneda, unidad, cantidad o importes/)).toBeInTheDocument();
    expect(screen.queryByText("Manual · conserva tus cambios")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Proveedor" }), { target: { value: "Proveedor ajustado" } });
    expect(screen.getByText("Manual · conserva tus cambios")).toBeInTheDocument();
    expect(screen.getByText(/Esta fila ya no se recalcula desde la tarifa o el flete del Paso 1/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Notas del concepto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar notas" })).toHaveAttribute("aria-expanded", "false");
    expect(filasActuales()[0]).toMatchObject({ proveedor: "Proveedor ajustado", costo_unitario: 100, precio_venta: 150,
      cantidad: 1, costeo_tarifa_id: null, costeo_tarifa_recargo_id: null });
    fireEvent.click(screen.getByRole("button", { name: "Recalcular precargas ficticias" }));
    expect(screen.getByText("Manual · conserva tus cambios")).toBeInTheDocument();
    expect(filasActuales()[0].proveedor).toBe("Proveedor ajustado");
  });

  it("el indicador reaparece al restaurar la fila marcada y conserva importes y linaje actuales", () => {
    const manual = { ...base, notas: `Editado a mano — ${NOTA_AUTO_TARIFA}`, costeo_tarifa_id: null, costeo_tarifa_recargo_id: null };
    render(<Fixture inicial={manual} />);
    expect(screen.getByText("Manual · conserva tus cambios")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Notas del concepto" })).not.toBeInTheDocument();
    expect(filasActuales()).toEqual([manual]);
  });

  it("no convierte una fila ni cambia su linaje por mostrar el aviso o abrir sus notas", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar notas" }));
    expect(screen.getByRole("textbox", { name: "Notas del concepto" })).toHaveValue(NOTA_AUTO_TARIFA);
    expect(screen.queryByText("Manual · conserva tus cambios")).not.toBeInTheDocument();
    expect(filasActuales()).toEqual([base]);
  });

  it("una fila manual de origen sin marca no recibe un estado falso de precarga editada", () => {
    const manual = { ...base, notas: "Nota libre ficticia", costeo_tarifa_id: null, costeo_tarifa_recargo_id: null };
    render(<Fixture inicial={manual} />);
    expect(screen.queryByText("Manual · conserva tus cambios")).not.toBeInTheDocument();
    expect(screen.queryByText(/Si editas el concepto/)).not.toBeInTheDocument();
    expect(filasActuales()).toEqual([manual]);
  });
});
