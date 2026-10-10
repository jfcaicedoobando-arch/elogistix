import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
import type { ConceptoVentaCotizacion, CostoCotizacion } from "@/features/cotizacion/types";
const m = vi.hoisted(() => ({ update: vi.fn(), costs: vi.fn(), create: vi.fn(), activity: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.error, notifySuccess: m.success, notifyWarning: vi.fn() }));
vi.mock("@/services/storage/index", () => ({ uploadFile: vi.fn() }));
vi.mock("@/features/cotizacion/services", async () => {
  const s = await import("@/features/cotizacion/services/wizard");
  return { savePaso2: s.savePaso2, savePaso3: s.savePaso3, savePasoFinal: s.savePasoFinal };
});
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/catalogos/hooks", () => ({ useTcDofPorFecha: () => ({ data: undefined, isFetching: false }) }));
vi.mock("@/features/cotizacion/hooks/wizard/useInvalidarTarifaAutomatica", () => ({ useInvalidarTarifaAutomatica: vi.fn() }));
vi.mock("@/features/cotizacion/hooks/wizard/useCambiarTipoEmbarque", () => ({ useCambiarTipoEmbarque: () => vi.fn() }));
vi.mock("@/features/cotizacion/hooks/wizard/usePaso1Handlers", () => ({ usePaso1Handlers: () => ({ validarParaFinalizar: async () => true }) }));
vi.mock("@/features/cotizacion/components/SeccionConceptosVentaCotizacion", () => ({ default: () => null }));
vi.mock("@/features/cotizacion/components/SeccionCostosInternosPLUnificado", () => ({ default: () => null }));
vi.mock("@/features/cotizacion/components/PasoResumenCotizacion", () => ({ default: () => null }));
vi.mock("../PasoDatosGenerales", () => ({ default: () => null }));
vi.mock("../Paso1ProgressSidebar", () => ({ default: () => null }));
import { useCotizacionWizardForm } from "@/features/cotizacion/hooks/wizard/useCotizacionWizardForm";
import { CotizacionWizardSteps } from "../CotizacionWizardSteps";
import { RecuperarConceptosDesdeCostos } from "../RecuperarConceptosDesdeCostos";
import { savePaso3 } from "@/features/cotizacion/services/wizard";
const costo: CostoCotizacion = { id: "cost-row-old", cotizacion_id: "quote-A", concepto: "Flete marítimo", cantidad: 1, costo_unitario: 1.23, costo_total: 1.23, precio_venta: 1.41, moneda: "USD", proveedor: "Proveedor", unidad_medida: "Contenedor", notas: "Nota", origen_venta_id: "stable-origin", costeo_tarifa_id: "tariff-A", costeo_tarifa_recargo_id: null, created_at: "", updated_at: "" };
const quote = makeCotizacionRow({ id: "quote-A", cliente_id: "client-A", oportunidad_id: "op-A", pricing_solicitud_id: "request-A", tarifa_id: "tariff-A", organization_id: "org-A", moneda: "MXN", conceptos_venta: [], subtotal: 0, tipo_cambio_usd: null });
const manual: ConceptoVentaCotizacion = { descripcion: "Manual que se conserva", cantidad: 1, precio_unitario: 0, total: 0, moneda: "USD", unidad_medida: "Servicio", aplica_iva: false };
function Harness({ ventas = [], cost = costo, pricing = true }: { ventas?: ConceptoVentaCotizacion[]; cost?: CostoCotizacion; pricing?: boolean }) {
  const w = useCotizacionWizardForm({ navigate: vi.fn(), toast: vi.fn(), userEmail: "", clientes: [], initialData: { ...quote, conceptos_venta: ventas, pricing_solicitud_id: pricing ? "request-A" : null }, initialCostos: [cost], mutations: { crearCotizacion: { mutateAsync: m.create, isPending: false }, updateCotizacion: { mutateAsync: m.update, isPending: false }, upsertCostos: { mutateAsync: m.costs, isPending: false }, registrarActividad: { mutate: m.activity } } });
  return <>
    <button onClick={() => w.setCurrentStep(3)}>Abrir Cliente</button>
    <button onClick={() => w.setCurrentStep(2)}>Volver a Costos</button>
    <button onClick={() => void w.handleSiguiente()}>Avanzar prueba</button>
    <button onClick={() => void w.handleGuardar()}>Guardar prueba</button>
    <button onClick={() => { w.setConceptosUSD([]); w.setConceptosMXN([]); }}>Borrar ventas localmente</button>
    <output data-testid="state">{JSON.stringify({ ventas: [...w.conceptosUSD, ...w.conceptosMXN].filter(v => v.descripcion.trim()), costos: w.costosInternos, cabecera: w.form.getValues(), tc: w.tipoCambioUsd, paso: w.currentStep })}</output>
    <CotizacionWizardSteps w={w} clientes={[]} esMaritimo sinDesgloseFlag={false} irACargarCostos={vi.fn()} />
  </>;
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);
const abrirCliente = () => fireEvent.click(screen.getByRole("button", { name: "Abrir Cliente" }));
const preparar = () => fireEvent.click(screen.getByRole("button", { name: "Preparar conceptos desde costos" }));
beforeEach(() => { vi.clearAllMocks(); m.update.mockResolvedValue("new-stamp"); m.costs.mockResolvedValue({ updatedAt: "cost-stamp" }); });

describe("recuperación explícita de edición vacía", () => {
  it("no reconstruye al abrir ni avanzar costos; decisión local muestra TC y conserva todos los orígenes", async () => {
    render(<Harness />); const antes = state();
    fireEvent.click(screen.getByRole("button", { name: "Volver a Costos" }));
    fireEvent.click(screen.getByRole("button", { name: "Avanzar prueba" }));
    await waitFor(() => expect(state().paso).toBe(3));
    expect(state().ventas).toEqual([]); expect(m.update).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Tipo de cambio USD/MXN *")).not.toBeInTheDocument();
    preparar();
    expect(state().ventas).toEqual([expect.objectContaining({ origen_costo_id: "stable-origin", descripcion: "Flete marítimo", moneda: "USD", precio_unitario: 1.41, cantidad: 1 })]);
    expect(state().costos).toEqual(antes.costos); expect(state().cabecera).toEqual(antes.cabecera);
    expect(screen.getByLabelText("Tipo de cambio USD/MXN *")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Preparar conceptos desde costos" })).not.toBeInTheDocument();
    expect(m.update).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it("origen NULL requiere guardar Costos antes de recuperar; venta usa el UUID confirmado, nunca la PK", async () => {
    render(<Harness cost={{ ...costo, origen_venta_id: null }} />); abrirCliente();
    const origenLocal = state().costos[0].origen_venta_id;
    expect(origenLocal).toBeTruthy(); expect(origenLocal).not.toBe(costo.id);
    expect(screen.getByRole("button", { name: "Preparar conceptos desde costos" })).toBeDisabled();
    preparar(); expect(state().ventas).toEqual([]); expect(m.update).not.toHaveBeenCalled(); expect(m.costs).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ir a Costos y utilidad" }));
    expect(state().paso).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Avanzar prueba" }));
    await waitFor(() => expect(state().paso).toBe(3));
    expect(m.costs).toHaveBeenCalledWith(expect.objectContaining({ cotizacionId: quote.id, expectedUpdatedAt: quote.updated_at, costos: [expect.objectContaining({ origen_venta_id: origenLocal, costeo_tarifa_id: "tariff-A", precio_venta: 1.41, moneda: "USD" })] }));
    expect(state().ventas).toEqual([]); preparar();
    fireEvent.change(screen.getByLabelText("Tipo de cambio USD/MXN *"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar prueba" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(1));
    expect(m.update.mock.calls[0][0]).toEqual(expect.objectContaining({ expectedUpdatedAt: "cost-stamp", data: expect.objectContaining({ moneda: "MXN", subtotal: 28.2, conceptos_venta: [expect.objectContaining({ origen_costo_id: origenLocal, moneda: "USD", precio_unitario: 1.41 })] }) }));
  });
  it.each(["error", "sin sello"])("guardar Costos con %s no confirma UUID sólo local", async (modo) => {
    if (modo === "error") m.costs.mockRejectedValueOnce(new Error("LC_CONFLICTO_CONCURRENCIA"));
    else m.costs.mockResolvedValueOnce({ updatedAt: null });
    render(<Harness cost={{ ...costo, origen_venta_id: null }} />); abrirCliente();
    fireEvent.click(screen.getByRole("button", { name: "Ir a Costos y utilidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Avanzar prueba" }));
    await waitFor(() => expect(m.costs).toHaveBeenCalledTimes(1));
    if (modo === "error") await waitFor(() => expect(m.error).toHaveBeenCalled());
    else await waitFor(() => expect(state().paso).toBe(3));
    abrirCliente();
    expect(screen.getByRole("button", { name: "Preparar conceptos desde costos" })).toBeDisabled();
    preparar(); expect(state().ventas).toEqual([]); expect(m.update).not.toHaveBeenCalled();
  });
  it("sin TC no guarda; TC20 guarda USD1.41 como subtotalMXN28.20 con sello y mismo ID", async () => {
    render(<Harness />); abrirCliente(); preparar();
    fireEvent.click(screen.getByRole("button", { name: "Avanzar prueba" }));
    await waitFor(() => expect(m.error).toHaveBeenCalled()); expect(m.update).not.toHaveBeenCalled(); expect(state().paso).toBe(3);
    fireEvent.change(screen.getByLabelText("Tipo de cambio USD/MXN *"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Avanzar prueba" }));
    await waitFor(() => expect(state().paso).toBe(4));
    expect(m.update).toHaveBeenCalledWith({ id: "quote-A", expectedUpdatedAt: quote.updated_at, data: { conceptos_venta: [expect.objectContaining({ origen_costo_id: "stable-origin", moneda: "USD", precio_unitario: 1.41 })], moneda: "MXN", subtotal: 28.2, tipo_cambio_usd: 20 } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar prueba" }));
    await waitFor(() => expect(m.success).toHaveBeenCalledTimes(1));
    expect(m.update.mock.calls[1][0]).toEqual({ ...m.update.mock.calls[0][0], expectedUpdatedAt: "new-stamp" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it.each(["", "0", "-1", "NaN", "abc"])("TC inválido %s no escribe ni confirma éxito", async (tc) => {
    render(<Harness />); abrirCliente(); preparar();
    fireEvent.change(screen.getByLabelText("Tipo de cambio USD/MXN *"), { target: { value: tc } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar prueba" }));
    await waitFor(() => expect(m.error).toHaveBeenCalled()); expect(m.update).not.toHaveBeenCalled(); expect(m.success).not.toHaveBeenCalled();
  });
  it.each([0, 7])("venta manual existente de importe %s no ofrece recuperación ni se sobrescribe", (precio) => {
    const venta = { ...manual, precio_unitario: precio, total: precio };
    render(<Harness ventas={[venta]} />); abrirCliente();
    expect(screen.queryByRole("button", { name: "Preparar conceptos desde costos" })).not.toBeInTheDocument();
    expect(state().ventas).toEqual([venta]); expect(m.update).not.toHaveBeenCalled();
  });
  it("vacío guardado/reabierto tampoco reconstruye automáticamente; PK nueva conserva origen estable", () => {
    const h = render(<Harness />); abrirCliente(); expect(state().ventas).toEqual([]);
    preparar(); const primera = state().ventas; h.unmount();
    render(<Harness cost={{ ...costo, id: "cost-row-replacement" }} />); abrirCliente();
    expect(state().ventas).toEqual([]); expect(m.update).not.toHaveBeenCalled();
    preparar(); expect(state().ventas).toEqual(primera); expect(state().ventas[0].origen_costo_id).toBe("stable-origin");
  });
  it("borrado voluntario no resucita ventas al cambiar de paso; recupera sólo con otra decisión", () => {
    render(<Harness ventas={[{ ...manual, precio_unitario: 5, total: 5 }]} />); abrirCliente();
    fireEvent.click(screen.getByRole("button", { name: "Borrar ventas localmente" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver a Costos" })); abrirCliente();
    expect(state().ventas).toEqual([]); expect(m.update).not.toHaveBeenCalled();
    preparar(); expect(state().ventas).toHaveLength(1);
  });
  it("snapshot vacío persistido por el servicio y reabierto exige nueva decisión explícita", async () => {
    const h = render(<Harness ventas={[{ ...manual, precio_unitario: 5, total: 5 }]} />); abrirCliente();
    fireEvent.click(screen.getByRole("button", { name: "Borrar ventas localmente" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar prueba" }));
    await waitFor(() => expect(m.error).toHaveBeenCalled());
    expect(m.update).not.toHaveBeenCalled(); // El wizard actual no finaliza capturas vacías.
    await savePaso3({ cotizacionId: quote.id, conceptosVenta: state().ventas, monedaFallback: "MXN", conservarMoneda: true, mutations: { updateCotizacion: { mutateAsync: m.update } } });
    const persistidas = m.update.mock.calls[0][0].data.conceptos_venta;
    expect(persistidas).toEqual([]); h.unmount(); m.update.mockClear();
    render(<Harness ventas={persistidas} />); abrirCliente();
    expect(state().ventas).toEqual([]); expect(m.update).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preparar conceptos desde costos" })).toBeInTheDocument();
    preparar(); expect(state().ventas).toHaveLength(1);
  });
  it("recarga con venta vinculada ya guardada no vuelve a preparar", () => {
    const h = render(<Harness />); abrirCliente(); preparar(); const ventas = state().ventas; h.unmount();
    render(<Harness ventas={ventas} cost={{ ...costo, id: "another-transient-pk" }} />); abrirCliente();
    expect(state().ventas).toEqual(ventas); expect(screen.queryByRole("button", { name: "Preparar conceptos desde costos" })).not.toBeInTheDocument();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("no amplía la recuperación a cotizaciones sin origen Pricing", () => {
    render(<Harness pricing={false} />); abrirCliente();
    expect(screen.queryByRole("button", { name: "Preparar conceptos desde costos" })).not.toBeInTheDocument();
  });
  it("dos invocaciones antes de actualizar props preparan el mismo snapshot sin acumular ventas", () => {
    const onPreparar = vi.fn();
    render(<RecuperarConceptosDesdeCostos esEdicion pricingSolicitudId="request-A" origenesConfirmados={new Set(["stable-origin"])} onIrACostos={vi.fn()} costos={[{ ...costo, precio_venta: 1.41, unidad_medida: "Contenedor" }]} ventas={[]} tasaIva={0.16} onPreparar={onPreparar} />);
    const boton = screen.getByRole("button", { name: "Preparar conceptos desde costos" });
    act(() => { boton.click(); boton.click(); });
    expect(onPreparar).toHaveBeenCalledTimes(2);
    expect(onPreparar.mock.calls[0][0]).toHaveLength(1); expect(onPreparar.mock.calls[1]).toEqual(onPreparar.mock.calls[0]);
  });
  it("doble clic y regresar a Cliente no duplican ni repiten recuperación", () => {
    render(<Harness />); abrirCliente(); const boton = screen.getByRole("button", { name: "Preparar conceptos desde costos" });
    fireEvent.click(boton); fireEvent.click(boton);
    expect(state().ventas).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Volver a Costos" })); abrirCliente();
    expect(state().ventas).toHaveLength(1); expect(screen.queryByRole("button", { name: "Preparar conceptos desde costos" })).not.toBeInTheDocument();
  });
});
