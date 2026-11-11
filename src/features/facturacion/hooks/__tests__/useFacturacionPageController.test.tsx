import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mocks = vi.hoisted(() => ({
  listado: vi.fn(), clientes: vi.fn(), exportRows: vi.fn(),
  activity: vi.fn(), csv: vi.fn(), layout: vi.fn(), error: vi.fn(), success: vi.fn(),
  state: { search: "", filters: { estado: "todos", cliente: "todos" }, page: 0, pageSize: 50 },
}));
vi.mock("@/features/facturacion/hooks/useFacturas", () => ({
  useFacturasListado: (args: unknown) => mocks.listado(args),
  useFacturasClientes: (enabled: boolean) => mocks.clientes(enabled),
}));
vi.mock("@/features/facturacion/services/facturasCrud", () => ({ fetchFacturasParaExportar: mocks.exportRows }));
vi.mock("@/hooks/shared", () => ({
  useListPageState: () => ({ ...mocks.state, setSearch: vi.fn(), setFilter: vi.fn(), setPage: vi.fn(), setPageSize: vi.fn() }),
  useDebounce: <T,>(v: T) => v,
  useOrgFilter: () => ({ organizationId: "org" }),
  useRegistrarActividad: () => ({ mutate: mocks.activity }),
  usePermissions: () => ({ canEdit: true }),
}));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: mocks.csv }));
vi.mock("@/generators/layoutContable", () => ({ exportarLayoutContable: mocks.layout }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.error, notifySuccess: mocks.success }));
import { useFacturacionPageController } from "../useFacturacionPageController";

const rows = Array.from({ length: 121 }, (_, n) => ({
  id: `f${n}`, numero: `FAC-${n}`, expediente: "EXP", cliente_nombre: "ACME",
  total: 1000 + n, moneda: n % 2 ? "USD" : "MXN", fecha_emision: "2026-01-15",
  fecha_vencimiento: "2026-02-15", estado: "Emitida",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = { search: "", filters: { estado: "todos", cliente: "todos" }, page: 0, pageSize: 50 };
  mocks.listado.mockReturnValue({ data: { data: rows.slice(0, 50), count: 121 }, isLoading: false, isError: false });
  mocks.clientes.mockReturnValue({ data: [{ id: "ACME", nombre: "ACME" }, { id: "Fuera de página", nombre: "Fuera de página" }] });
  mocks.exportRows.mockResolvedValue(rows);
  mocks.layout.mockResolvedValue(undefined);
});

describe("Facturación: filtros y exportación completa", () => {
  it("envía cliente y fechas al servidor, conserva total filtrado y catálogo independiente de página", () => {
    mocks.state = { search: "FAC", filters: { estado: "Emitida", cliente: "ACME" }, page: 1, pageSize: 50 };
    const { result } = renderHook(() => useFacturacionPageController({ fechaDesde: "2026-01-01", fechaHasta: "2026-01-31", activeTab: "emitidas" }), { wrapper: createWrapper() });
    expect(mocks.listado).toHaveBeenLastCalledWith(expect.objectContaining({
      search: "FAC", estado: "Emitida", clienteNombre: "ACME", fechaDesde: "2026-01-01", fechaHasta: "2026-01-31", page: 1, pageSize: 50,
    }));
    expect(result.current.paginatedFacturas).toHaveLength(50);
    expect(result.current.totalCount).toBe(121);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.clientesDisponibles[1].nombre).toBe("Fuera de página");
  });

  it("CSV exporta todas las páginas filtradas conservando monto y moneda originales", async () => {
    mocks.state.filters.cliente = "ACME";
    const { result } = renderHook(() => useFacturacionPageController({ fechaDesde: "2026-01-01", fechaHasta: "2026-01-31" }), { wrapper: createWrapper() });
    await act(async () => { await result.current.exportarFacturasCsv(); });
    expect(mocks.exportRows).toHaveBeenCalledWith(expect.objectContaining({ clienteNombre: "ACME", fechaDesde: "2026-01-01", fechaHasta: "2026-01-31", organizationId: "org" }));
    expect(mocks.exportRows.mock.calls[0][0]).not.toHaveProperty("page");
    const [filename, headers, exported] = mocks.csv.mock.calls[0];
    expect(filename).toMatch(/^facturas_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(headers.map((h: { key: string }) => h.key)).toEqual(["numero", "expediente", "cliente", "total", "moneda", "emision", "vencimiento", "estado"]);
    expect(exported).toHaveLength(121);
    expect(exported[120]).toMatchObject({ numero: "FAC-120", total: 1120, moneda: "MXN" });
    expect(exported[119]).toMatchObject({ total: 1119, moneda: "USD" });
  });

  it("layout recibe todas las facturas y registra el total completo", async () => {
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    await act(async () => { await result.current.exportarLayoutContable(); });
    expect(mocks.layout).toHaveBeenCalledWith(rows);
    expect(mocks.activity).toHaveBeenCalledWith(expect.objectContaining({ entidad_nombre: "Layout contable (121 facturas)" }));
  });

  it("no produce archivo parcial ni éxito si falla cargar otra página", async () => {
    mocks.exportRows.mockRejectedValueOnce(new Error("segunda página"));
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    await act(async () => { await result.current.exportarFacturasCsv(); });
    expect(mocks.csv).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
    expect(result.current.exportando).toBe(false);
  });

  it("rechaza rango invertido y no consulta ni exporta ese universo", async () => {
    const { result } = renderHook(() => useFacturacionPageController({ fechaDesde: "2026-02-01", fechaHasta: "2026-01-31" }), { wrapper: createWrapper() });
    expect(mocks.listado).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(result.current.rangoInvalido).toBe(true);
    expect(result.current.exportDisabled).toBe(true);
    await act(async () => { await result.current.exportarFacturasCsv(); });
    expect(mocks.exportRows).not.toHaveBeenCalled();
  });

  it("evita lanzar dos exportaciones mientras la primera está pendiente", async () => {
    let resolve!: (value: typeof rows) => void;
    mocks.exportRows.mockReturnValueOnce(new Promise<typeof rows>((r) => { resolve = r; }));
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    let pending!: Promise<void>;
    act(() => { pending = result.current.exportarFacturasCsv(); });
    expect(result.current.exportando).toBe(true);
    await act(async () => { await result.current.exportarLayoutContable(); });
    expect(mocks.exportRows).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(rows); await pending; });
    expect(result.current.exportando).toBe(false);
  });
});
