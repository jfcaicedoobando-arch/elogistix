/**
 * Regresión: al elegir una actividad en la paleta CRM se navega a
 * /crm/actividades con ?q=<asunto> para que quede filtrada y visible.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("@/hooks/shared", () => ({ useDebounce: (v: string) => v }));
vi.mock("@/features/crm/hooks", () => ({
  useCrmSearch: () => ({
    data: [
      { kind: "actividad", id: "a1", title: "Llamada a QA Cliente", subtitle: "Pendiente" },
    ],
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import CrmCommandPalette from "@/features/crm/components/CrmCommandPalette";

describe("CrmCommandPalette — actividades", () => {
  it("navega con q=<asunto>", () => {
    render(
      <MemoryRouter>
        <CrmCommandPalette open onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Llamada a QA Cliente"));
    expect(navigate).toHaveBeenCalledWith(
      `/crm/actividades?q=${encodeURIComponent("Llamada a QA Cliente")}`,
    );
  });
});
