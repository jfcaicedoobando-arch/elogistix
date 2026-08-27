import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConvertirLeadSheet from "@/features/crm/components/ConvertirLeadSheet";
import type { CrmLeadRow } from "@/features/crm/hooks";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  navigate: vi.fn(),
}));

vi.mock("@/features/crm/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/crm/hooks")>()),
  useConvertirLead: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
}));

vi.mock("@/features/cliente/hooks", () => ({
  useClientesForSelect: () => ({ data: [{ id: "cli-1", nombre: "ACME" }], isLoading: false }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
}));

vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

const leadBase = {
  id: "lead-1",
  empresa: "IAASA",
  estado: "Calificado",
  oportunidad_convertida_id: null,
  cliente_convertido_id: null,
} as unknown as CrmLeadRow;

function renderSheet(props: Partial<React.ComponentProps<typeof ConvertirLeadSheet>> = {}) {
  return render(
    <MemoryRouter>
      <ConvertirLeadSheet
        open
        onOpenChange={props.onOpenChange ?? vi.fn()}
        lead={props.lead ?? leadBase}
        onAbrirAvanzado={props.onAbrirAvanzado ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("ConvertirLeadSheet · regresión SIN_CLIENTE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutateAsync.mockReset();
  });

  it("renderiza sin lanzar ReferenceError por SIN_CLIENTE", () => {
    expect(() => renderSheet()).not.toThrow();
    expect(screen.getByText("Convertir lead")).toBeTruthy();
  });

  it("muestra la opción 'Sin cliente' por defecto", () => {
    renderSheet();
    expect(screen.getByText("Sin cliente (ligar después)")).toBeTruthy();
  });
});
