import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoordinadorSelect } from "@/components/shared/CoordinadorSelect";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      opciones: [
        { id: "coord-1", nombre: "Coordinador Uno", role: "coordinador_logistico" },
        { id: "gerente-1", nombre: "Gerente Uno", role: "gerente_operaciones" },
      ],
      nombres: new Map(),
    },
    isLoading: false,
  }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org-1" }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const props = {
  value: null,
  label: "Coordinador logístico",
  editable: true,
  onGuardar: vi.fn(),
  onGuardado: vi.fn(),
};

describe("CoordinadorSelect", () => {
  it("excluye gerentes cuando la asignación sólo admite coordinadores", () => {
    render(<CoordinadorSelect {...props} soloCoordinadores />);
    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Coordinador Uno" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gerente Uno" })).not.toBeInTheDocument();
  });

  it("conserva gerentes entre las opciones del handover", () => {
    render(<CoordinadorSelect {...props} />);
    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Gerente Uno" })).toBeInTheDocument();
  });
});
