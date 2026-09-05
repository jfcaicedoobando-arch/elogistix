/**
 * Auditoría CRM — detalle de oportunidad/lead no confunde error con
 * "no encontrada": isError → ErrorState con Reintentar; respuesta exitosa
 * sin registro → "no encontrada/o".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const useOportunidad = vi.fn();
const useEtapasPipeline = vi.fn();
const useLead = vi.fn();
const useLeadEditForm = vi.fn();
const acciones = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useOportunidad: (...a: unknown[]) => useOportunidad(...a),
  useEtapasPipeline: (...a: unknown[]) => useEtapasPipeline(...a),
  useLead: (...a: unknown[]) => useLead(...a),
  useLeadEditForm: (...a: unknown[]) => useLeadEditForm(...a),
}));
vi.mock("@/features/crm/hooks/useLeadDetalleAcciones", () => ({
  useLeadDetalleAcciones: (...a: unknown[]) => acciones(...a),
}));
vi.mock("@/hooks/shared", () => ({
  useDocumentTitle: () => {},
  usePermissions: () => ({
    canTomarLead: () => false,
    canGestionarLead: () => false,
    canAltaCliente: () => false,
    canCrearOportunidad: () => false,
  }),
}));
vi.mock("@/hooks/shared/useVolver", () => ({ useVolver: () => "/crm/leads" }));
vi.mock("@/features/crm/components/oportunidadDetalle/OportunidadDetalleContent", () => ({
  OportunidadDetalleContent: () => <div>contenido</div>,
}));
vi.mock("@/components/shared/DetailHeader", () => ({ DetailHeader: () => <div /> }));
vi.mock("@/features/crm/components/LineageCard", () => ({ LeadLineageCard: () => <div /> }));
vi.mock("@/features/crm/components/ActividadTimeline", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/leadDetalle/LeadDatosCard", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/leadDetalle/LeadIcpCard", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/leadDetalle/LeadDetalleHeader", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/leadDetalle/LeadGateProspectoDialog", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/leadDetalle/LeadEtapaProspectoAviso", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/leadDetalle/OportunidadesDelProspecto", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({ default: () => <div /> }));
vi.mock("@/components/shared/DoubleConfirmDeleteDialog", () => ({ default: () => <div /> }));

import OportunidadDetalle from "../OportunidadDetalle";
import LeadDetalle from "../LeadDetalle";

interface Q { data?: unknown; isLoading?: boolean; isError?: boolean; refetch: () => void }

beforeEach(() => {
  vi.clearAllMocks();
  useEtapasPipeline.mockReturnValue({ data: [] });
  useLeadEditForm.mockReturnValue({ form: {}, set: vi.fn(), dirty: false, patch: vi.fn() });
  acciones.mockReturnValue({
    handleSave: vi.fn(), handleDelete: vi.fn(), handleCalificar: vi.fn(), handleTomar: vi.fn(),
    guardando: false, eliminando: false, tomando: false, calificando: false, errorEmail: null,
    faltantesGate: [], cerrarGate: vi.fn(),
  });
});

function renderOp() {
  return render(
    <MemoryRouter initialEntries={["/crm/oportunidades/op-1"]}>
      <Routes><Route path="/crm/oportunidades/:id" element={<OportunidadDetalle />} /></Routes>
    </MemoryRouter>,
  );
}
function renderLead() {
  return render(
    <MemoryRouter initialEntries={["/crm/leads/l-1"]}>
      <Routes><Route path="/crm/leads/:id" element={<LeadDetalle />} /></Routes>
    </MemoryRouter>,
  );
}

describe("OportunidadDetalle — error vs no encontrada", () => {
  it("error de red/RLS muestra ErrorState con Reintentar y NO 'no encontrada'", () => {
    const refetch = vi.fn();
    useOportunidad.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } satisfies Q);
    renderOp();
    expect(screen.getByText(/No se pudo cargar la oportunidad/i)).toBeInTheDocument();
    expect(screen.queryByText(/Oportunidad no encontrada/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("éxito sin registro sí muestra 'no encontrada'", () => {
    useOportunidad.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() } satisfies Q);
    renderOp();
    expect(screen.getByText(/Oportunidad no encontrada/i)).toBeInTheDocument();
    expect(screen.queryByText(/No se pudo cargar/i)).toBeNull();
  });
});

describe("LeadDetalle — error vs no encontrado", () => {
  it("error de red/RLS muestra ErrorState con Reintentar y NO 'no encontrado'", () => {
    const refetch = vi.fn();
    useLead.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } satisfies Q);
    renderLead();
    expect(screen.getByText(/No se pudo cargar el lead/i)).toBeInTheDocument();
    expect(screen.queryByText(/Lead no encontrado/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("éxito sin registro sí muestra 'no encontrado'", () => {
    useLead.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() } satisfies Q);
    renderLead();
    expect(screen.getByText(/Lead no encontrado/i)).toBeInTheDocument();
    expect(screen.queryByText(/No se pudo cargar/i)).toBeNull();
  });
});
