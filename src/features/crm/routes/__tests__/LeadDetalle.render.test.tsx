/**
 * Regresión: en la ficha de un prospecto no debe haber duplicidad entre
 * `OportunidadesDelProspecto` y `LeadLineageCard`. Para leads que no son
 * prospectos se conserva la trazabilidad con `LeadLineageCard`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useLeadMock = vi.fn();

vi.mock("@/components/shared/PageContainer", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="page-container">{children}</div>,
}));

vi.mock("@/components/shared/states/LoadingState", () => ({
  LoadingState: ({ label }: { label: string }) => <div data-testid="loading">{label}</div>,
}));

vi.mock("@/components/shared/states/ErrorState", () => ({
  ErrorState: ({ title }: { title: string }) => <div data-testid="error">{title}</div>,
}));

vi.mock("@/components/shared/DetailHeader", () => ({
  DetailHeader: ({ title }: { title: string }) => <div data-testid="detail-header">{title}</div>,
}));

vi.mock("@/components/shared/DoubleConfirmDeleteDialog", () => ({
  default: () => <div data-testid="delete-dialog" />,
}));

vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({
    canTomarLead: () => true,
    canGestionarLead: () => true,
    canAltaCliente: () => true,
    canCrearOportunidad: () => true,
  }),
  useDocumentTitle: () => {},
}));

vi.mock("@/hooks/shared/useVolver", () => ({
  useVolver: () => vi.fn(),
}));

vi.mock("@/features/crm/components/LineageCard", () => ({
  LeadLineageCard: ({ leadId }: { leadId: string }) => <div data-testid={`lineage-${leadId}`}>Lineage</div>,
}));

vi.mock("@/features/crm/components/ActividadTimeline", () => ({
  default: () => <div data-testid="timeline" />,
}));

vi.mock("@/features/crm/components/leadDetalle/LeadDatosCard", () => ({
  default: () => <div data-testid="datos-card" />,
}));

vi.mock("@/features/crm/components/leadDetalle/LeadIcpCard", () => ({
  default: () => <div data-testid="icp-card" />,
}));

vi.mock("@/features/crm/components/leadDetalle/LeadDetalleHeader", () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock("@/features/crm/components/leadDetalle/LeadGateProspectoDialog", () => ({
  default: () => <div data-testid="gate-dialog" />,
}));

vi.mock("@/features/crm/components/leadDetalle/LeadEtapaProspectoAviso", () => ({
  default: () => <div data-testid="aviso" />,
}));

vi.mock("@/features/crm/components/leadDetalle/OportunidadesDelProspecto", () => ({
  default: ({ leadId }: { leadId: string }) => <div data-testid={`oportunidades-${leadId}`}>Oportunidades</div>,
}));

vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({
  default: () => <div data-testid="nueva-oportunidad-dialog" />,
}));

vi.mock("@/features/crm/hooks", () => ({
  useLead: (id?: string) => useLeadMock(id),
  useLeadEditForm: () => ({
    form: { register: vi.fn(), watch: vi.fn(), formState: {} },
    set: vi.fn(),
    dirty: false,
    patch: {},
  }),
}));

vi.mock("@/features/crm/hooks/useLeadDetalleAcciones", () => ({
  useLeadDetalleAcciones: () => ({
    handleSave: vi.fn(),
    handleDelete: vi.fn(),
    handleCalificar: vi.fn(),
    handleTomar: vi.fn(),
    guardando: false,
    eliminando: false,
    tomando: false,
    calificando: false,
    errorEmail: null,
    faltantesGate: [],
    cerrarGate: vi.fn(),
  }),
}));

vi.mock("@/constants/routes", () => ({
  ROUTES: { CRM_LEADS: "/crm/leads", CRM_OPORTUNIDADES: "/crm/oportunidades", CLIENTES: "/clientes" },
}));

import LeadDetalle from "@/features/crm/routes/LeadDetalle";

const leadBase = {
  id: "l1",
  empresa: "ACME",
  estado: "Nuevo",
  vendedor_id: "u1",
  vendedor_email: "v@example.com",
};

const renderLead = (estado: string) => {
  useLeadMock.mockReturnValue({
    data: { ...leadBase, estado },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={[`/crm/leads/${leadBase.id}`]}>
      <LeadDetalle />
    </MemoryRouter>,
  );
};

describe("LeadDetalle · renderizado condicional de oportunidades", () => {
  beforeEach(() => {
    useLeadMock.mockReset();
  });

  it("para un Prospecto muestra OportunidadesDelProspecto y no LeadLineageCard", () => {
    renderLead("Prospecto");
    expect(screen.getByTestId("oportunidades-l1")).toBeInTheDocument();
    expect(screen.queryByTestId("lineage-l1")).not.toBeInTheDocument();
  });

  it("para un Lead no prospecto muestra LeadLineageCard y no OportunidadesDelProspecto", () => {
    renderLead("Nuevo");
    expect(screen.getByTestId("lineage-l1")).toBeInTheDocument();
    expect(screen.queryByTestId("oportunidades-l1")).not.toBeInTheDocument();
  });

  it("para 'Pendiente de alta' (otro prospecto) muestra sólo OportunidadesDelProspecto", () => {
    renderLead("Pendiente de alta");
    expect(screen.getByTestId("oportunidades-l1")).toBeInTheDocument();
    expect(screen.queryByTestId("lineage-l1")).not.toBeInTheDocument();
  });

  it("para 'Calificado' (otro prospecto) muestra sólo OportunidadesDelProspecto", () => {
    renderLead("Calificado");
    expect(screen.getByTestId("oportunidades-l1")).toBeInTheDocument();
    expect(screen.queryByTestId("lineage-l1")).not.toBeInTheDocument();
  });
});
