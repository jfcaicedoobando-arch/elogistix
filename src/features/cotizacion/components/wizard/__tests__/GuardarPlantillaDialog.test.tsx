/**
 * Tests P2 cierre (v13.296.0) — GuardarPlantillaDialog + helper limpiarValues.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { GuardarPlantillaDialog } from "@/features/cotizacion/components/wizard/GuardarPlantillaDialog";
import { limpiarValues } from "@/features/cotizacion/components/wizard/guardarPlantillaHelpers";

const insertMock = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => {
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn((row: unknown) => {
      insertMock(row);
      return chain;
    });
    chain.single = vi.fn(() => Promise.resolve({ data: { id: "new" }, error: null }));
    return chain;
  });
  return { supabase: { from } };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("limpiarValues (P2 cierre)", () => {
  it("elimina folios, IDs y fechas del payload", () => {
    const input = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: "cot-1",
      folio: "COT-2026-0123",
      fecha_cotizacion: "2026-07-13",
      fecha_vencimiento: "2026-07-27",
      tarifa_id: "tarifa-1",
      tarifa_snapshot: { foo: 1 },
      cliente_id: "cli-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const out = limpiarValues(input);
    expect(out).toEqual({ cliente_id: "cli-1" });
  });
});

describe("GuardarPlantillaDialog", () => {
  beforeEach(() => insertMock.mockReset());

  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    organizationId: "org-1",
    usuarioId: "u1",
    values: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      folio: "COT-1",
      cliente_id: "c1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };

  it("botón Guardar deshabilitado con nombre < 3 chars", () => {
    render(<GuardarPlantillaDialog {...baseProps} />, { wrapper });
    const btn = screen.getByRole("button", { name: /guardar plantilla/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "AB" } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Shanghai-MZLO" } });
    expect(btn).not.toBeDisabled();
  });

  it("al Guardar envía payload sin folios y con la visibilidad seleccionada", async () => {
    render(<GuardarPlantillaDialog {...baseProps} />, { wrapper });
    fireEvent.change(screen.getByLabelText(/nombre/i), {
      target: { value: "Ruta frecuente" },
    });
    // Cambia a visibilidad org
    fireEvent.click(screen.getByLabelText(/toda la organización/i));

    fireEvent.click(screen.getByRole("button", { name: /guardar plantilla/i }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    const row = insertMock.mock.calls[0][0] as {
      nombre: string;
      visibilidad: string;
      payload: { values: Record<string, unknown> };
    };
    expect(row.nombre).toBe("Ruta frecuente");
    expect(row.visibilidad).toBe("org");
    expect(row.payload.values).toEqual({ cliente_id: "c1" });
    expect(row.payload.values).not.toHaveProperty("folio");
  });
});
