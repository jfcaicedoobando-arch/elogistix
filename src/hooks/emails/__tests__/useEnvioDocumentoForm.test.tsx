import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mocks = vi.hoisted(() => ({
  fetchContactos: vi.fn(),
}));

vi.mock("@/features/cotizacion/services/envios", () => ({
  fetchContactosClienteConEmail: (id: string) => mocks.fetchContactos(id),
  esContactoPrioridadCliente: (c: { tipo?: string }) =>
    c?.tipo === "principal" || c?.tipo === "facturacion",
  CLIENTE_PRINCIPAL_ID: "__cliente_principal__",
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "yo@empresa.com" } }),
}));

import { useEnvioDocumentoForm } from "../useEnvioDocumentoForm";

describe("useEnvioDocumentoForm", () => {
  beforeEach(() => {
    mocks.fetchContactos.mockReset();
  });

  it("preselecciona el contacto principal cuando existe", async () => {
    mocks.fetchContactos.mockResolvedValue([
      { id: "__cliente_principal__", email: "principal@x.com", contacto: "Principal", tipo: "principal" },
      { id: "c2", email: "otro@x.com", contacto: "Otro", tipo: "operativo" },
    ]);
    const { result } = renderHook(
      () => useEnvioDocumentoForm(true, "cli-1", () => "Asunto inicial"),
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(result.current.destinatarios.map((d) => d.email)).toContain(
        "principal@x.com",
      ),
    );
    expect(result.current.asunto).toBe("Asunto inicial");
  });

  it("añade y quita emails manuales con validación", async () => {
    mocks.fetchContactos.mockResolvedValue([]);
    const { result } = renderHook(
      () => useEnvioDocumentoForm(true, "cli-1", () => ""),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.loadingContactos).toBe(false));

    // email inválido no se agrega
    act(() => result.current.setEmailManual("no-es-email"));
    act(() => result.current.agregarManual());
    expect(result.current.emailsManualesAgregados).toEqual([]);

    // email válido sí
    act(() => result.current.setEmailManual("nuevo@x.com"));
    act(() => result.current.agregarManual());
    expect(result.current.emailsManualesAgregados).toEqual(["nuevo@x.com"]);

    // aparece en destinatarios
    expect(result.current.destinatarios.map((d) => d.email)).toContain(
      "nuevo@x.com",
    );

    // quitar
    act(() => result.current.quitarManual("nuevo@x.com"));
    expect(result.current.emailsManualesAgregados).toEqual([]);
  });

  it("agrega al usuario logueado como CC por defecto", async () => {
    mocks.fetchContactos.mockResolvedValue([
      { id: "__cliente_principal__", email: "p@x.com", contacto: "P", tipo: "principal" },
    ]);
    const { result } = renderHook(
      () => useEnvioDocumentoForm(true, "cli-1", () => ""),
      { wrapper: createWrapper() },
    );
    await waitFor(() =>
      expect(result.current.destinatarios.length).toBeGreaterThan(0),
    );
    expect(result.current.ccEmails).toContain("yo@empresa.com");
  });
});
