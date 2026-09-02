/**
 * Test de regresión — v13.823.61
 *
 * Congela los DOS consumos de las capacidades de leads (no sólo el hook):
 *  - `OportunidadesDelProspecto`: su botón "Nueva oportunidad" obedece el
 *    ownership del lead (`puedeGestionar`), no el permiso global de edición.
 *  - `QuickAddMenu`: "Importar leads CSV" sólo aparece para quien puede
 *    gestionar leads en lote.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/shared", () => ({ usePermissions: vi.fn() }));
vi.mock("@/features/crm/hooks", () => ({ useOportunidadesPorLead: vi.fn() }));

// Los diálogos del menú rápido no participan en este contrato.
vi.mock("@/features/crm/components/NuevoLeadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/NuevaOportunidadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/NuevaActividadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/ImportarLeadsCsvDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/quickCreate/QuickCreateLeadDialog", () => ({ default: () => null }));
vi.mock("@/features/crm/components/quickCreate/QuickCreateOportunidadDialog", () => ({
  default: () => null,
}));
vi.mock("@/features/crm/components/quickCreate/QuickCreateActividadDialog", () => ({
  default: () => null,
}));

import { usePermissions } from "@/hooks/shared";
import { useOportunidadesPorLead } from "@/features/crm/hooks";
import OportunidadesDelProspecto from "@/features/crm/components/leadDetalle/OportunidadesDelProspecto";
import QuickAddMenu from "@/features/crm/components/QuickAddMenu";

const mockedPermisos = vi.mocked(usePermissions);
const mockedOportunidades = vi.mocked(useOportunidadesPorLead);

function setPermisos(parcial: Record<string, unknown>) {
  // SAFE-CAST: cada consumo lee sólo las capacidades declaradas aquí.
  mockedPermisos.mockReturnValue(parcial as unknown as ReturnType<typeof usePermissions>);
}

describe("consumo de capacidades de leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // SAFE-CAST: la tarjeta sólo usa data/isLoading.
    mockedOportunidades.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<
      typeof useOportunidadesPorLead
    >);
  });

  it("OportunidadesDelProspecto oculta 'Nueva oportunidad' sin ownership", () => {
    setPermisos({});
    render(<OportunidadesDelProspecto leadId="l1" canEdit={false} onNuevaOportunidad={vi.fn()} />, {
      wrapper: MemoryRouter,
    });
    expect(screen.queryByRole("button", { name: /nueva oportunidad/i })).toBeNull();
  });

  it("OportunidadesDelProspecto muestra 'Nueva oportunidad' con ownership", () => {
    setPermisos({});
    render(<OportunidadesDelProspecto leadId="l1" canEdit onNuevaOportunidad={vi.fn()} />, {
      wrapper: MemoryRouter,
    });
    expect(screen.getByRole("button", { name: /nueva oportunidad/i })).toBeTruthy();
  });

  it("QuickAddMenu oculta 'Importar leads CSV' sin gestión en lote", async () => {
    setPermisos({ canCrearLead: true, canGestionarLeadsEnLote: false });
    render(<QuickAddMenu />, { wrapper: MemoryRouter });
    await userEvent.click(screen.getByRole("button", { name: /nuevo/i }));
    expect(screen.getByText("Nuevo lead")).toBeTruthy();
    expect(screen.queryByText(/importar leads csv/i)).toBeNull();
  });

  it("QuickAddMenu muestra 'Importar leads CSV' con gestión en lote", async () => {
    setPermisos({ canCrearLead: false, canGestionarLeadsEnLote: true });
    render(<QuickAddMenu />, { wrapper: MemoryRouter });
    await userEvent.click(screen.getByRole("button", { name: /nuevo/i }));
    expect(screen.getByText(/importar leads csv/i)).toBeTruthy();
    expect(screen.queryByText("Nuevo lead")).toBeNull();
  });
});
