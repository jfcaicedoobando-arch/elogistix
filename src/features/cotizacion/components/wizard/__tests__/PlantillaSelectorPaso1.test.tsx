/**
 * Tests P2 cierre (v13.296.0) — PlantillaSelectorPaso1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PlantillaSelectorPaso1 } from "@/features/cotizacion/components/wizard/PlantillaSelectorPaso1";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = {
  plantillas: [] as Array<{
    id: string;
    nombre: string;
    descripcion: string | null;
    veces_usada: number;
    visibilidad: string;
  }>,
  rpcData: null as unknown,
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
    return chain;
  });
  const rpc = vi.fn(() => Promise.resolve({ data: state.rpcData, error: null }));
  return { supabase: { from, rpc } };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeForm() {
  return {
    getValues: vi.fn(() => ({ ruta: "" })),
    reset: vi.fn(),
    trigger: vi.fn(() => Promise.resolve(true)),
     
  } as any;
}

describe("PlantillaSelectorPaso1 (P2 cierre)", () => {
  beforeEach(() => {
    state.plantillas = [];
    state.rpcData = null;
  });

  it("no renderiza si no hay organizationId", () => {
    const { container } = render(
      <PlantillaSelectorPaso1 organizationId={null} form={makeForm()} />,
      { wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it("no renderiza cuando la lista de plantillas está vacía", async () => {
    const { container } = render(
      <PlantillaSelectorPaso1 organizationId="org-1" form={makeForm()} />,
      { wrapper },
    );
    // Espera a que la query resuelva y colapse el nodo.
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it("aplica plantilla → form.reset + trigger + onApplied", async () => {
    state.plantillas = [
      {
        id: "p1",
        nombre: "Shanghai → MZLO",
        descripcion: null,
        veces_usada: 3,
        visibilidad: "org",
      },
    ];
    state.rpcData = { version: 1, values: { ruta: "SHA-MZLO" } };
    const form = makeForm();
    const onApplied = vi.fn();

    render(
      <PlantillaSelectorPaso1
        organizationId="org-1"
        form={form}
        onApplied={onApplied}
      />,
      { wrapper },
    );

    // Espera a que aparezca el CTA (después de que carga la lista).
    const trigger = await screen.findByRole("button", { name: /elegir plantilla/i });
    fireEvent.click(trigger);

    const item = await screen.findByText("Shanghai → MZLO");
    fireEvent.click(item);

    await waitFor(() => expect(form.reset).toHaveBeenCalledTimes(1));
    const [values, opts] = form.reset.mock.calls[0];
    expect(values).toMatchObject({ ruta: "SHA-MZLO" });
    expect(opts).toEqual({ keepDefaultValues: true });
    expect(form.trigger).toHaveBeenCalled();
    expect(onApplied).toHaveBeenCalled();
  });
});
