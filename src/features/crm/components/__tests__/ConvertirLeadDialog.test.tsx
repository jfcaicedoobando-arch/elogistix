import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConvertirLeadDialog from "@/features/crm/components/ConvertirLeadDialog";
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
  notifyError: vi.fn(),
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

function renderDialog(props: Partial<React.ComponentProps<typeof ConvertirLeadDialog>> = {}) {
  return render(
    <MemoryRouter>
      <ConvertirLeadDialog
        open
        onOpenChange={props.onOpenChange ?? vi.fn()}
        lead={props.lead ?? leadBase}
      />
    </MemoryRouter>,
  );
}

describe("ConvertirLeadDialog · regresión SIN_CLIENTE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutateAsync.mockReset();
  });

  it("renderiza el diálogo sin lanzar ReferenceError por SIN_CLIENTE", () => {
    expect(() => renderDialog()).not.toThrow();
    expect(screen.getByText("Convertir lead")).toBeTruthy();
  });

  it("muestra la opción 'Sin cliente' por defecto cuando no hay cliente convertido", () => {
    renderDialog();
    expect(screen.getByText("Sin cliente (ligar después)")).toBeTruthy();
  });

  it("muestra modo de solo lectura cuando el lead ya fue convertido", () => {
    const leadConvertido = {
      ...leadBase,
      estado: "Convertido",
      cliente_convertido_id: "cli-1",
      oportunidad_convertida_id: "op-1",
    } as unknown as CrmLeadRow;
    renderDialog({ lead: leadConvertido });
    expect(screen.getByText("Este lead ya fue convertido.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ver cliente/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ver oportunidad/i })).toBeTruthy();
  });
});

describe("ConvertirLeadDialog · reinicio de borrador al cambiar de lead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reinicia el borrador cuando cambia lead.id (no envía datos del lead A al B)", () => {
    const { rerender } = renderDialog();
    const input = screen.getByLabelText("Nombre de la oportunidad");
    fireEvent.change(input, { target: { value: "Editado A" } });
    const leadB = { ...leadBase, id: "lead-2", empresa: "BETA SA" } as unknown as CrmLeadRow;
    rerender(
      <MemoryRouter>
        <ConvertirLeadDialog open onOpenChange={vi.fn()} lead={leadB} />
      </MemoryRouter>,
    );
    expect((screen.getByLabelText("Nombre de la oportunidad") as HTMLInputElement).value)
      .toBe("Oportunidad — BETA SA");
  });

  it("conserva la edición mientras el mismo lead sigue abierto", () => {
    const { rerender } = renderDialog();
    const input = screen.getByLabelText("Nombre de la oportunidad");
    fireEvent.change(input, { target: { value: "Editado A" } });
    rerender(
      <MemoryRouter>
        <ConvertirLeadDialog open onOpenChange={vi.fn()} lead={{ ...leadBase }} />
      </MemoryRouter>,
    );
    expect((screen.getByLabelText("Nombre de la oportunidad") as HTMLInputElement).value)
      .toBe("Editado A");
  });

  it("al cambiar a un lead ya convertido respeta cliente_convertido_id", () => {
    const { rerender } = renderDialog();
    const leadConvertido = {
      ...leadBase,
      id: "lead-3",
      estado: "Convertido",
      cliente_convertido_id: "cli-1",
      oportunidad_convertida_id: "op-1",
    } as unknown as CrmLeadRow;
    rerender(
      <MemoryRouter>
        <ConvertirLeadDialog open onOpenChange={vi.fn()} lead={leadConvertido} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Este lead ya fue convertido.")).toBeTruthy();
  });
});
