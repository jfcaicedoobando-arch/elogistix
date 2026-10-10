import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/types/appRole";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import type { TarifaRespuestaRow } from "@/features/crm/services/pricing/tarifasRespuesta";
import { SolicitudPricingDetalle } from "../SolicitudPricingDetalle";

const m = vi.hoisted(() => ({
  navigate: vi.fn(), accion: vi.fn(), elegir: vi.fn(),
  role: "admin" as AppRole | null, userId: "usuario", tarifas: [] as TarifaRespuestaRow[],
}));
vi.mock("react-router", async (o) => ({ ...(await o<typeof import("react-router")>()), useNavigate: () => m.navigate }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ role: m.role, effectiveRole: m.role, user: { id: m.userId } }) }));
vi.mock("@/features/crm/hooks/usePricingCrm", () => ({
  useOpcionesPricing: () => ({ data: [] }),
  useAccionSolicitud: () => ({ isPending: false, mutate: m.accion }),
}));
vi.mock("@/features/crm/hooks/useTarifasRespuestaPricing", () => ({
  useTarifasRespuestaPricing: () => ({ data: m.tarifas, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/crm/hooks/useOpcionesTarifario", () => ({
  useOpcionesTarifario: () => ({ opciones: m.tarifas, elegida: null, esFob: false,
    cargosFob: [], cargosLocales: [], isLoading: false, busy: null, elegir: m.elegir }),
}));
vi.mock("@/features/costeo", () => ({ TarifaForm: () => null }));
vi.mock("../AdjuntosSolicitudPricing", () => ({ AdjuntosSolicitudPricing: () => null }));
vi.mock("../ResumenSolicitudPricing", () => ({ ResumenSolicitudPricing: () => null }));
vi.mock("../OpcionPricingEditor", () => ({ OpcionPricingEditor: () => null }));
vi.mock("../RelojPricing", () => ({ RelojPricing: () => null }));

const solicitud: SolicitudPricingRow = {
  id: "sol", organization_id: "org", oportunidad_id: "op", solicitante_id: "solicitante", created_by: "creador",
  estado: "respondida", folio: "SOL-1", fecha: "2026-10-10", complejidad: "baja", created_at: "", updated_at: "",
  cantidad: 1, cliente: null, commodity: null, container_size: null, deleted_at: null, delivery: null,
  destino: "Manzanillo", dimensiones: null, enviada_at: null, estibable: null, fecha_tentativa_carga: null,
  imo: null, incoterm: "FAS", notas: null, origen: "Ningbo", peso: null, pod: null, pol: null,
  respondida_at: null, servicio: "Marítimo", tipo_carga: "40' High Cube", unidad_medida: null,
  vence_at: null, tarifa_tarifario_id: null,
};
const tarifa: TarifaRespuestaRow = {
  id: "tarifa-respuesta", flete_base: 1.23, moneda: "USD", unidad_flete: null, carta_garantia: null,
  transit_time_dias: null, vigente_hasta: "2026-11-08", agente: { nombre: "Agente" },
  naviera: { name: "APL" }, tipo: { code: "40HC" }, ruta: { origen: { name: "Ningbo" }, destino: { name: "Manzanillo" } },
};
const botonCotizar = () => screen.queryByRole("button", { name: "Cotizar con esta opción" });
beforeEach(() => { vi.clearAllMocks(); m.role = "admin"; m.userId = "usuario"; m.tarifas = [tarifa]; });
afterEach(cleanup);

describe("cotizar la respuesta desde el detalle compartido de CRM y bandeja", () => {
  it("mantiene una acción al pasar de Enviada a Respondida sin opción de tarifario elegida", () => {
    const { rerender } = render(<SolicitudPricingDetalle solicitud={{ ...solicitud, estado: "enviada" }} />);
    expect(screen.getByRole("button", { name: "Usar esta opción" })).toBeInTheDocument();
    expect(botonCotizar()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar respondida" }));
    expect(m.accion).toHaveBeenCalledWith({ id: "sol", oportunidadId: "op", accion: "responder" });
    rerender(<SolicitudPricingDetalle solicitud={solicitud} />);
    expect(screen.queryByRole("button", { name: "Usar esta opción" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cotizar con esta opción" }));
    expect(m.navigate).toHaveBeenCalledExactlyOnceWith("/cotizaciones/nueva?tarifa=tarifa-respuesta&solicitud=sol&oportunidad=op");
    expect(m.elegir).not.toHaveBeenCalled();
    expect(m.accion).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Agregar tarifa" })).not.toBeInTheDocument();
  });
  it.each(["admin", "admin_org", "super_admin", "ejecutivo_pricing", "gerente_operaciones"] as const)("permite cotizar al rol Pricing %s sin ser creador", (role) => {
    m.role = role;
    render(<SolicitudPricingDetalle solicitud={solicitud} />);
    expect(botonCotizar()).toBeInTheDocument();
  });
  it.each(["creador", "solicitante"])("permite al vendedor %s y conserva la tarifa elegida de entre varias", (userId) => {
    m.role = "vendedor"; m.userId = userId; m.tarifas = [tarifa, { ...tarifa, id: "otra-respuesta" }];
    render(<SolicitudPricingDetalle solicitud={solicitud} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Cotizar con esta opción" })[1]);
    expect(m.navigate).toHaveBeenCalledExactlyOnceWith("/cotizaciones/nueva?tarifa=otra-respuesta&solicitud=sol&oportunidad=op");
    expect(m.elegir).not.toHaveBeenCalled(); expect(m.accion).not.toHaveBeenCalled();
  });
  it("no amplía el acceso a un vendedor ajeno a la solicitud", () => {
    m.role = "vendedor";
    render(<SolicitudPricingDetalle solicitud={solicitud} />);
    expect(botonCotizar()).not.toBeInTheDocument();
  });
  it.each(["contador", "tesorero", "gerente_visor", null] as const)("no permite cotizar al creador sin escritura (%s)", (role) => {
    m.role = role; m.userId = "creador";
    render(<SolicitudPricingDetalle solicitud={solicitud} />);
    expect(botonCotizar()).not.toBeInTheDocument();
    expect(screen.getByText("Opción 1")).toBeInTheDocument();
  });
  it("no cotiza una solicitud cancelada", () => {
    render(<SolicitudPricingDetalle solicitud={{ ...solicitud, estado: "cancelada" }} />);
    expect(botonCotizar()).not.toBeInTheDocument();
  });
  it("omite oportunidad vacía sin inventar un vínculo", () => {
    render(<SolicitudPricingDetalle solicitud={{ ...solicitud, oportunidad_id: "" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Cotizar con esta opción" }));
    expect(m.navigate).toHaveBeenCalledExactlyOnceWith("/cotizaciones/nueva?tarifa=tarifa-respuesta&solicitud=sol");
  });
});
