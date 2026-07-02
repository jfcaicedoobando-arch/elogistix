import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

const { mock } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return { mock: createSupabaseMock() };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { useDestinatariosSugeridos } from "../useDestinatariosSugeridos";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useDestinatariosSugeridos", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
  });

  it("no hace fetch cuando clienteId es null", async () => {
    const { result } = renderHook(() => useDestinatariosSugeridos(null), { wrapper });
    // Espera un tick para asegurar que enabled=false no dispara query.
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.data).toBeUndefined();
    expect(mock.tableCalls.length).toBe(0);
  });

  it("combina envios (destinatarios+cc) con contactos, dedup case-insensitive, filtra inválidos", async () => {
    mock.setTableResult("proforma_envios", {
      data: [
        {
          destinatarios: [{ email: "A@b.com" }, { email: "no-es-email" }],
          cc: ["C@b.com", "a@b.COM"],
          created_at: "2026-07-01T10:00:00Z",
        },
        {
          destinatarios: ["d@b.com"],
          cc: null,
          created_at: "2026-06-30T10:00:00Z",
        },
      ],
      error: null,
    });
    mock.setTableResult("contactos_cliente", {
      data: [{ email: "e@b.com" }, { email: null }, { email: "A@B.COM" }],
      error: null,
    });

    const { result } = renderHook(() => useDestinatariosSugeridos("cli-1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.sugerencias).toEqual([
      "a@b.com",
      "c@b.com",
      "d@b.com",
      "e@b.com",
    ]);
    // El "ultimo" viene del envío más reciente (primer row).
    expect(result.current.data!.ultimo).toEqual({
      to: ["a@b.com"],
      cc: ["c@b.com", "a@b.com"],
    });
  });

  it("ultimo es null cuando no hay envíos previos", async () => {
    mock.setTableResult("proforma_envios", { data: [], error: null });
    mock.setTableResult("contactos_cliente", {
      data: [{ email: "solo@contacto.com" }],
      error: null,
    });
    const { result } = renderHook(() => useDestinatariosSugeridos("cli-2"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.sugerencias).toEqual(["solo@contacto.com"]);
    expect(result.current.data!.ultimo).toBeNull();
  });

  it("tolera destinatarios/cc no-array sin crash", async () => {
    mock.setTableResult("proforma_envios", {
      data: [{ destinatarios: null, cc: "no-array", created_at: "2026-07-01" }],
      error: null,
    });
    mock.setTableResult("contactos_cliente", { data: [], error: null });
    const { result } = renderHook(() => useDestinatariosSugeridos("cli-3"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.sugerencias).toEqual([]);
    expect(result.current.data!.ultimo).toEqual({ to: [], cc: [] });
  });
});
