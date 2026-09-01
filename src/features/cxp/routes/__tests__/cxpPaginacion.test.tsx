/**
 * Paginación única de la pantalla CxP: `data` ya viene completa del servicio,
 * la tabla sólo corta la página visible. Antes el servicio cortaba en 200 y la
 * página volvía a cortar a 100, así que la factura 201 no existía para la UI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FacturaCxP } from "@/features/cxp/services";

const { mockFacturas, mockPageState, tablaProps } = vi.hoisted(() => ({
  mockFacturas: vi.fn(),
  mockPageState: vi.fn(),
  tablaProps: { current: null as Record<string, unknown> | null },
}));

vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: mockFacturas,
  useCxpPageState: mockPageState,
  useEliminarFacturaProveedor: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCxpDeepLinks: () => undefined,
}));
vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canCapturarFacturaProveedor: true }),
  useColumnVisibility: () => ({
    visibility: {}, toggle: vi.fn(), reset: vi.fn(), isCustom: false, setVisibility: vi.fn(),
  }),
  useDocumentTitle: () => undefined,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({
  ResponsiveDataTable: (props: Record<string, unknown>) => {
    tablaProps.current = props;
    const filas = props.data as FacturaCxP[];
    return (
      <div data-testid="tabla">
        {filas.map((f) => <span key={f.id}>{f.folio_interno}</span>)}
      </div>
    );
  },
}));
vi.mock("@/features/cxp/routes/_sections/CxpRouteDialogs", () => ({ CxpRouteDialogs: () => null }));
vi.mock("@/features/cxp/components/CxpFiltros", () => ({ CxpFiltros: () => null }));
vi.mock("@/features/cxp/components/CxpKpiCards", () => ({
  CxpKpiCards: ({ data }: { data: FacturaCxP[] }) => <div data-testid="kpis">{data.length}</div>,
}));

import Cxp from "../Cxp";

function factura(i: number): FacturaCxP {
  return {
    id: `f${i}`, folio_interno: `FI-${i}`, folio_proveedor: `FP-${i}`,
    proveedor_id: "p1", proveedor_nombre: "Proveedor", proveedor_origen: "Nacional",
    embarque_id: null, embarque_expediente: null,
    fecha_emision: "2026-01-01", fecha_vencimiento: "2026-02-01", dias_vencido: 0,
    moneda: "MXN", total: 100, pagado: 0, notas_credito: 0, saldo: 100,
    estado: "Vigente", estatus: "Vigente", tipo_cambio_usd: 1,
    estado_aprobacion: "aprobada", motivo_rechazo: null,
    categoria_presupuesto_id: null, categoria_nombre: null,
    subtotal: 100, iva: 0, ieps: 0, retenciones: 0,
    rfc_proveedor: null, uuid_fiscal: null, dias_credito: 30, notas: null,
    archivo_xml_url: null, archivo_pdf_url: null,
    uuid_verificado: false, uuid_verificado_fecha: null, uuid_estatus_sat: null,
    fecha_programada_pago: null, fecha_cancelacion: null, motivo_cancelacion: null,
    cancelada_por: null, created_by: null,
    flags: { parcial: false, parcialPct: 0, ncAplicada: false, satVerificada: false, canceladaPor: null },
  } as FacturaCxP;
}

const DATA = Array.from({ length: 250 }, (_, i) => factura(i + 1));

function estado(page: number) {
  return {
    search: "", setSearch: vi.fn(), debouncedSearch: "", page, setPage: vi.fn(), pageSize: 100,
    estatus: "todos", setEstatus: vi.fn(), moneda: "todas", setMoneda: vi.fn(),
    origen: "todos", setOrigen: vi.fn(), aprobacion: "todos", setAprobacion: vi.fn(),
    proveedorId: "todos", setProveedorId: vi.fn(),
    categoriaPresupuestoId: "todas", setCategoriaPresupuestoId: vi.fn(),
    fechaDesde: "", setFechaDesde: vi.fn(), fechaHasta: "", setFechaHasta: vi.fn(),
    hayFiltros: false, queryArgs: {},
    openNueva: false, setOpenNueva: vi.fn(), pagar: null, setPagar: vi.fn(),
    detalle: null, setDetalle: vi.fn(), editar: null, setEditar: vi.fn(),
    aEliminar: null, setAEliminar: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tablaProps.current = null;
  mockFacturas.mockReturnValue({
    data: DATA, isLoading: false, isError: false, refetch: vi.fn(),
    kpis: { por_pagar_mxn: 25_000, por_pagar_usd: 0, vencido_mxn: 0, vencido_usd: 0,
      por_vencer_7d_mxn: 0, por_vencer_7d_usd: 0, facturas_vencidas: 0 },
  });
});

describe("Cxp — paginación única en memoria", () => {
  it("la factura 201 aparece en la tercera página", () => {
    mockPageState.mockReturnValue(estado(2));
    render(<Cxp />);
    expect(screen.getByText("FI-201")).toBeInTheDocument();
    expect(screen.queryByText("FI-1")).not.toBeInTheDocument();
  });

  it("total y totalPages salen del conjunto completo", () => {
    mockPageState.mockReturnValue(estado(0));
    render(<Cxp />);
    const pag = tablaProps.current?.pagination as { total: number; totalPages: number; page: number };
    expect(pag.total).toBe(250);
    expect(pag.totalPages).toBe(3);
    expect(pag.page).toBe(0);
  });

  it("página fuera de rango no muestra tabla vacía: se acota a la última", () => {
    mockPageState.mockReturnValue(estado(9));
    render(<Cxp />);
    const pag = tablaProps.current?.pagination as { page: number };
    expect(pag.page).toBe(2);
    expect(screen.getByText("FI-250")).toBeInTheDocument();
  });

  it("los KPIs reciben el conjunto completo, no la página visible", () => {
    mockPageState.mockReturnValue(estado(0));
    render(<Cxp />);
    expect(screen.getByTestId("kpis").textContent).toBe("250");
  });
});
