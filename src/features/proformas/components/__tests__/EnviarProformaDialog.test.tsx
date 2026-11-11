/**
 * Smoke test para el modal EnviarProformaDialog centrado en la nueva
 * funcionalidad de "ocultar correos recientes".
 */
import { webcrypto } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const { invokeMock, useDestinatariosSugeridosMock, sonnerToastMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  useDestinatariosSugeridosMock: vi.fn(),
  sonnerToastMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

vi.mock("@/features/proformas/hooks/useDestinatariosSugeridos", () => ({
  useDestinatariosSugeridos: (...args: unknown[]) => useDestinatariosSugeridosMock(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(sonnerToastMock, {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifyInfo: (_t: unknown, opts: { title: string; description?: string; action?: unknown }) =>
    sonnerToastMock(opts.title, { description: opts.description, action: opts.action }),
}));

import { EnviarProformaDialog } from "../EnviarProformaDialog";
import type { ProformaDetalleFull } from "@/features/proformas/services";

const proforma = {
  id: "p1",
  cliente_id: "cli-1",
  cliente_nombre: "ACME",
  numero: "PRO-2026-0001",
  expediente: "EXP-1",
} as unknown as ProformaDetalleFull;

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(EnviarProformaDialog, {
        open: true,
        onOpenChange: vi.fn(),
        proforma,
      }),
    ),
  );
}

describe("EnviarProformaDialog — ocultar correos recientes", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    window.localStorage.clear();
    invokeMock.mockReset();
    sonnerToastMock.mockReset();
    useDestinatariosSugeridosMock.mockReturnValue({
      data: {
        sugerencias: ["a@x.com", "b@x.com", "c@x.com"],
        ultimo: { to: [], cc: [] },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("muestra el resultado por destinatario y reconcilia con la misma clave", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { estado: "pendiente", enlace_portal: "https://portal/abc",
        resultados: [{ email: "a@x.com", tipo: "to", estado: "enviado" },
          { email: "b@x.com", tipo: "to", estado: "pendiente" }] },
      error: null,
    }).mockResolvedValueOnce({
      data: { estado: "enviado", enlace_portal: "https://portal/abc",
        resultados: [{ email: "b@x.com", tipo: "to", estado: "enviado" }] },
      error: null,
    });
    renderDialog();
    fireEvent.change(screen.getByLabelText("Para *"), { target: { value: "a@x.com, b@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar correo" }));
    expect(await screen.findByText("a@x.com · Enviado")).toBeVisible();
    expect(screen.getByText("b@x.com · Pendiente de confirmar")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar envío" }));
    expect(await screen.findByText("b@x.com · Enviado")).toBeVisible();
    expect(invokeMock.mock.calls[1][1].body.intento_id).toEqual(invokeMock.mock.calls[0][1].body.intento_id);
    expect(invokeMock.mock.calls[0][1].body.intento_id).toMatch(/^[\da-f-]{36}$/);
  });

  it("renderiza chips de correos recientes", () => {
    renderDialog();
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("b@x.com")).toBeInTheDocument();
    expect(screen.getByText("c@x.com")).toBeInTheDocument();
  });

  it("click en ✕ oculta el correo y llama a sonner.toast con acción Deshacer", async () => {
    renderDialog();
    const boton = screen.getByRole("button", { name: "Ocultar b@x.com" });
    fireEvent.click(boton);

    await waitFor(() => {
      expect(screen.queryByText("b@x.com")).not.toBeInTheDocument();
    });
    expect(sonnerToastMock).toHaveBeenCalledWith(
      "Correo ocultado",
      expect.objectContaining({
        description: "b@x.com",
        action: expect.objectContaining({ label: "Deshacer" }),
      }),
    );
  });

  it("enlace 'Restaurar ocultos' aparece y restaura los correos", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar a@x.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar b@x.com" }));

    const restaurar = await screen.findByRole("button", { name: /Restaurar ocultos \(2\)/ });
    fireEvent.click(restaurar);

    await waitFor(() => {
      expect(screen.getByText("a@x.com")).toBeInTheDocument();
      expect(screen.getByText("b@x.com")).toBeInTheDocument();
    });
  });

  it("click en chip agrega el correo al input Para", () => {
    renderDialog();
    fireEvent.click(screen.getByText("a@x.com"));
    const input = screen.getByLabelText("Para *") as HTMLInputElement;
    expect(input.value).toBe("a@x.com");
  });

  it("al enviar, los correos usados se reactivan (quedan visibles después del envío)", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, enlace_portal: "https://portal/abc", estado: "enviado" },
      error: null,
    });
    renderDialog();

    // Oculta a@x.com, luego lo escribe manualmente y envía.
    fireEvent.click(screen.getByRole("button", { name: "Ocultar a@x.com" }));
    const input = screen.getByLabelText("Para *") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a@x.com" } });

    const enviar = screen.getByRole("button", { name: /Enviar correo/ });
    fireEvent.click(enviar);

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    // El storage debe estar limpio (a@x.com se reactivó tras el envío).
    const key = "lc:proformas:emails-ocultos:cli-1";
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    expect(stored).not.toContain("a@x.com");
  });
});
