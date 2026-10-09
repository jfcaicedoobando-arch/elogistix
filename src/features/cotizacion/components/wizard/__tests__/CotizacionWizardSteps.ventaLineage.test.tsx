import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { useForm } from "react-hook-form";
import { calcularTotalesPL } from "@/lib/financial/profitUtils";
import type { ConceptoVentaCotizacion, CotizacionFormValues, FilaCostoLocal } from "@/features/cotizacion/types";

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (value: string) => void }) => <select aria-label="Vínculo venta" value={value} onChange={e => onValueChange(e.target.value)}><option value="">Conservar</option>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));
vi.mock("@/features/cotizacion/components/SeccionConceptosVentaCotizacion", () => ({ default: () => <div>Conceptos de venta</div> }));
vi.mock("@/features/cotizacion/components/SeccionCostosInternosPLUnificado", () => ({ default: () => <div>Costos internos</div> }));
vi.mock("@/features/cotizacion/components/PasoResumenCotizacion", () => ({ default: () => null }));
vi.mock("../PasoDatosGenerales", () => ({ default: () => null }));
vi.mock("../Paso1ProgressSidebar", () => ({ default: () => null }));
vi.mock("../TipoCambioCotizacionCard", () => ({ TipoCambioCotizacionCard: () => null }));
vi.mock("@/features/cotizacion/components/SinDesgloseBanner", () => ({ SinDesgloseBanner: () => null }));

import { CotizacionWizardSteps } from "../CotizacionWizardSteps";

const costo: FilaCostoLocal = { origen_venta_id: "cost-A", venta_vinculo_pendiente: true, concepto: "Flete", moneda: "USD", proveedor: "Naviera", cantidad: 1, costo_unitario: 1, precio_venta: 2, unidad_medida: "Servicio" };
const venta: ConceptoVentaCotizacion = { descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, unidad_medida: "Servicio", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 116 };
const manualUSD: ConceptoVentaCotizacion = { ...venta, descripcion: "Manual USD" };
const manualMXN: ConceptoVentaCotizacion = { ...venta, descripcion: "Manual MXN", moneda: "MXN", precio_unitario: 10200, total: 11832 };

function wizard(currentStep: number) {
  const setters = { setCostosInternos: vi.fn(), setConceptosUSD: vi.fn(), setConceptosMXN: vi.fn() };
  const { result } = renderHook(() => useForm<CotizacionFormValues>());
  const w: ComponentProps<typeof CotizacionWizardSteps>["w"] = {
    getCostosSincronizados: vi.fn(() => [costo]), restaurarCostosSincronizados: vi.fn(),
    currentStep, form: result.current, costosInternos: [costo], tasaIva: 0.16,
    conceptosUSD: [venta, manualUSD], conceptosMXN: [manualMXN], costosPreLlenados: true,
    isEditMode: true, setCurrentStep: vi.fn(), cotizacionId: "cot-1", setCotizacionId: vi.fn(),
    isPending: false, costosDesajuste: null, setCostosDesajuste: vi.fn(),
    msdsFile: null, setMsdsFile: vi.fn(), esMaritimo: true, esAereo: false, clienteSeleccionado: undefined,
    handleCambiarTipoEmbarque: vi.fn(), actualizarConcepto: vi.fn(), agregarConcepto: vi.fn(),
    agregarConceptoPrefill: vi.fn(), eliminarConcepto: vi.fn(), totalUSD: 232, subtotalMXN: 10200,
    ivaMXN: 1632, totalMXN: 11832, tipoCambioUsd: null, setTipoCambioUsd: vi.fn(),
    plUSD: calcularTotalesPL([costo]), plMXN: calcularTotalesPL([]), costosUSD: [costo], costosMXN: [],
    handleSiguiente: vi.fn().mockResolvedValue(undefined), handleGuardar: vi.fn().mockResolvedValue(undefined),
    handleBack: vi.fn(), handleCotizarSinDesglose: vi.fn().mockResolvedValue(undefined),
    selloActual: vi.fn(() => null), resincronizarSello: vi.fn(),
    vinculoCrmError: null, vinculoCrmConfirmado: false, limpiarVinculoCrmError: vi.fn(),
    ...setters,
  };
  return { w, ...setters };
}

describe("Audit145: integración del vínculo legado en el paso de ventas", () => {
  it("sólo presenta la revisión en el paso 3 y no cambia datos al abrirla", () => {
    const { w, setCostosInternos, setConceptosUSD, setConceptosMXN } = wizard(2);
    const props = { clientes: [], esMaritimo: true, sinDesgloseFlag: false, irACargarCostos: vi.fn() };
    const { rerender } = render(<CotizacionWizardSteps {...props} w={w} />);
    expect(screen.queryByText("Revisa las ventas sin vínculo a costos")).not.toBeInTheDocument();
    rerender(<CotizacionWizardSteps {...props} w={{ ...w, currentStep: 3 }} />);
    expect(screen.getByText("Revisa las ventas sin vínculo a costos")).toBeInTheDocument();
    expect(screen.getByText(/Tus conceptos manuales e impuestos se conservan/)).toBeInTheDocument();
    expect(setCostosInternos).not.toHaveBeenCalled();
    expect(setConceptosUSD).not.toHaveBeenCalled();
    expect(setConceptosMXN).not.toHaveBeenCalled();
  });

  it("aplicar vínculo actualiza costo y venta seleccionada sin perder ventas manuales USD/MXN", () => {
    const { w, setCostosInternos, setConceptosUSD, setConceptosMXN } = wizard(3);
    render(<CotizacionWizardSteps w={w} clientes={[]} esMaritimo sinDesgloseFlag={false} irACargarCostos={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Vínculo venta"), { target: { value: "0" } });
    expect(setCostosInternos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar vínculo" }));
    expect(setCostosInternos).toHaveBeenCalledWith([{ ...costo, venta_vinculo_pendiente: false }]);
    expect(setConceptosUSD).toHaveBeenCalledWith([
      { ...venta, origen_costo_id: "cost-A", precio_unitario: 2, total: 2.32 }, manualUSD,
    ]);
    expect(setConceptosMXN).toHaveBeenCalledWith([manualMXN]);
    expect(setConceptosUSD.mock.calls[0][0][1]).toBe(manualUSD);
    expect(setConceptosMXN.mock.calls[0][0][0]).toBe(manualMXN);
  });
});
