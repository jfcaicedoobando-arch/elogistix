/**
 * Tests P2 cierre (v13.296.0) — página `/cotizaciones/plantillas`.
 * Renderiza filas, filtra por visibilidad, abre confirmación de eliminación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import CotizacionPlantillas from "@/features/cotizacion/routes/CotizacionPlantillas";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org-1" }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ organizationId: "org-1" }),
}));

const state = {
  plantillas: [
    {
      id: "p1",
      organization_id: "org-1",
      usuario_id: "u1",
      nombre: "Shanghai → MZLO",
      descripcion: "Marítimo 40HC",
      visibilidad: "org",
      payload: { version: 1, values: {} },
      veces_usada: 5,
      ultima_uso_at: null,
      created_at: "2026-01-01",
      updated_at: "2026-07-01",
    },
    {
      id: "p2",
      organization_id: "org-1",
      usuario_id: "u1",
      nombre: "Nueva particular",
      descripcion: null,
      visibilidad: "yo",
      payload: { version: 1, values: {} },
      veces_usada: 0,
      ultima_uso_at: null,
      created_at: "2026-02-01",
      updated_at: "2026-07-05",
    },
  ],
};

vi.mock("@/integrations/supabase/client", () => {
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() =>
      Promise.resolve({ data: state.plantillas, error: null }),
    );
    chain.update = vi.fn(() => chain);
    chain.then = (r: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(r);
    return chain;
  });
  return { supabase: { from } };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CotizacionPlantillas página (P2 cierre)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza las plantillas de la organización", async () => {
    render(<CotizacionPlantillas />, { wrapper });
    expect(await screen.findByText("Shanghai → MZLO")).toBeInTheDocument();
    expect(screen.getByText("Nueva particular")).toBeInTheDocument();
  });

  it("filtra por visibilidad 'sólo mías'", async () => {
    render(<CotizacionPlantillas />, { wrapper });
    await screen.findByText("Shanghai → MZLO");

    const select = screen.getByLabelText(/filtrar visibilidad/i);
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole("option", { name: /sólo mías/i }));

    await waitFor(() =>
      expect(screen.queryByText("Shanghai → MZLO")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Nueva particular")).toBeInTheDocument();
  });

  it("la búsqueda filtra por nombre", async () => {
    render(<CotizacionPlantillas />, { wrapper });
    await screen.findByText("Shanghai → MZLO");

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "Nueva" },
    });

    await waitFor(() =>
      expect(screen.queryByText("Shanghai → MZLO")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Nueva particular")).toBeInTheDocument();
  });
});
