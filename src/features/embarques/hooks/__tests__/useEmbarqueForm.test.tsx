import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useEmbarqueForm } from "../useEmbarqueForm";

const remoto = vi.hoisted(() => ({ data: null as { usdMxn: number; eurMxn: number; fecha: string; fuente: string } | null }));

// v13.410.1: el hook precarga el T/C vía `useTcInicial` (DOF preferente), no
// directamente desde `useExchangeRates`.
vi.mock("@/features/catalogos/hooks/useTcInicial", () => ({
  useTcInicial: () => ({
    data: remoto.data,
    isLoading: false,
  }),
}));

vi.mock("@/services/storage/index", () => ({
  uploadFile: vi.fn().mockResolvedValue({}),
}));

// v13.137.24: `createWrapper()` se instancia POR test. Antes se compartía a
// nivel módulo y el `afterEach` global (que limpia el QueryClient registrado)
// dejaba los tests 2 y 3 apuntando a un cliente ya cancelado.
const makeWrapper = () => createWrapper();

beforeEach(() => { remoto.data = { usdMxn: 20, eurMxn: 22, fecha: "2026-08-04", fuente: "DOF" }; });

describe("useEmbarqueForm", () => {
  it("DOF tardío no pisa el TC sellado de la cotización", async () => {
    remoto.data = null;
    const { result, rerender } = renderHook(() => useEmbarqueForm(), { wrapper: makeWrapper() });
    await act(async () => { result.current.vincularCotizacion({
      cliente_id: "cli-mock", modo: "Marítimo", tipo: "Importación", incoterm: "FOB",
      descripcion_mercancia: "Refacciones CNC", tipo_carga: "General", tipo_contenedor: "40HC",
      peso_kg: 8400, volumen_m3: 18.5, piezas: 12, origen: "Ningbo", destino: "Manzanillo",
      tipo_cambio_usd: 18.5, tipo_cambio_eur: 21.2,
    }); });
    remoto.data = { usdMxn: 18.071, eurMxn: 20, fecha: "2026-09-30", fuente: "DOF" };
    rerender();
    expect(result.current.methods.getValues("tipoCambioUSD")).toBe("18.5");
    expect(result.current.methods.getValues("tipoCambioEUR")).toBe("21.2");
  });

  it("DOF tardío respeta un borrador restaurado por reset aunque no sea dirty", () => {
    remoto.data = null;
    const { result, rerender } = renderHook(() => useEmbarqueForm(), { wrapper: makeWrapper() });
    act(() => result.current.methods.reset({ ...result.current.methods.getValues(), tipoCambioUSD: "18.5", tipoCambioEUR: "21.2" }));
    remoto.data = { usdMxn: 18.071, eurMxn: 20, fecha: "2026-09-30", fuente: "DOF" };
    rerender();
    expect(result.current.methods.getValues("tipoCambioUSD")).toBe("18.5");
    expect(result.current.methods.getValues("tipoCambioEUR")).toBe("21.2");
  });
  it("inicializa con valores por defecto y sincroniza tipos de cambio", () => {
    const { result } = renderHook(() => useEmbarqueForm(), { wrapper: makeWrapper() });
    expect(result.current.methods.getValues("tipoCambioUSD")).toBe("20");
    expect(result.current.methods.getValues("tipoCambioEUR")).toBe("22");
  });

  it("gestiona archivos de documentos", () => {
    const { result } = renderHook(() => useEmbarqueForm(), { wrapper: makeWrapper() });
    const file = new File([""], "test.pdf", { type: "application/pdf" });
    // "Factura Comercial" es el nombre exacto del documento para el modo Marítimo
    // según getDocsForMode("Marítimo") en embarqueConstants.
    const docNombre = "Factura Comercial";

    act(() => {
      result.current.setDocumentoArchivo(docNombre, file);
    });

    expect(result.current.documentosArchivos[docNombre]).toBe(file);

    const checklist = result.current.getDocumentosChecklist("Marítimo");
    const facturaEntry = checklist.find(d => d.nombre === docNombre);
    expect(facturaEntry?.adjuntado).toBe(true);
  });

  it("vincular y desvincular cotización actualiza campos", async () => {
    const { result } = renderHook(() => useEmbarqueForm(), { wrapper: makeWrapper() });
    const mockCot = {
      id: "cot-1",
      folio: "COT-001",
      cliente_id: "cli-1",
      modo: "Marítimo",
      tipo: "FCL",
      referencia_cliente: "REF-123",
      bl_master: "BL123",
    };

    // v13.137.25: `vincularCotizacion`/`desvincularCotizacion` llaman a
    // `methods.trigger()` (async, devuelve Promise<boolean>). Sin `await act`
    // las microtasks de RHF resuelven fuera del boundary y React 18 puede
    // dejar updates colgados bajo singleFork.
    await act(async () => {
      result.current.vincularCotizacion(mockCot as unknown as Parameters<typeof result.current.vincularCotizacion>[0]);
    });

    expect(result.current.methods.getValues("clienteId")).toBe("cli-1");
    expect(result.current.methods.getValues("modo")).toBe("Marítimo");

    await act(async () => {
      result.current.desvincularCotizacion();
    });

    expect(result.current.methods.getValues("clienteId")).toBe("");
  });
});
