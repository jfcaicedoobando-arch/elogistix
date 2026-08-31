import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { enviarEstadoCuentaEmail } from "@/features/cobranza/services/estadoCuentaService";

beforeEach(() => {
  supabaseMock.functions.invoke.mockReset();
});

describe("enviarEstadoCuentaEmail", () => {
  it("camino feliz: envía el body normalizado y devuelve el resultado", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "cliente@correo.mx" },
      error: null,
    });

    const r = await enviarEstadoCuentaEmail({
      clienteId: "cli-1",
      periodo: "2026-08",
      contactoEmail: "  cliente@correo.mx  ",
      mensaje: "  hola  ",
      fechaDesde: "2026-08-01",
      fechaHasta: "2026-08-31",
    });

    expect(r).toEqual({ ok: true, enviado_a: "cliente@correo.mx" });
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-estado-cuenta-enviar",
      {
        body: {
          cliente_id: "cli-1",
          periodo: "2026-08",
          contacto_email: "cliente@correo.mx",
          mensaje: "hola",
          fecha_desde: "2026-08-01",
          fecha_hasta: "2026-08-31",
        },
      },
    );
  });

  it("normaliza campos opcionales ausentes a null", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "x@y.mx" },
      error: null,
    });

    await enviarEstadoCuentaEmail({ clienteId: "cli-2" });

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-estado-cuenta-enviar",
      {
        body: {
          cliente_id: "cli-2",
          periodo: null,
          contacto_email: null,
          mensaje: null,
          fecha_desde: null,
          fecha_hasta: null,
        },
      },
    );
  });

  it("estado de cuenta: lanza cuando supabase devuelve error de transporte", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("network down"),
    });

    await expect(enviarEstadoCuentaEmail({ clienteId: "cli-3" })).rejects.toThrow(
      "network down",
    );
  });

  it("lanza mensaje genérico cuando data.ok es falso", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: false },
      error: null,
    });

    await expect(enviarEstadoCuentaEmail({ clienteId: "cli-4" })).rejects.toThrow(
      "No se pudo enviar el estado de cuenta",
    );
  });

  it("lanza cuando data es null (sin ok)", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: null });

    await expect(enviarEstadoCuentaEmail({ clienteId: "cli-5" })).rejects.toThrow(
      "No se pudo enviar el estado de cuenta",
    );
  });

  it("Ola v16 (5): usa el motivo del body 4xx de la Edge Function, no el mensaje técnico", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({ error: "El cliente no tiene contactos con correo." }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      },
    });

    await expect(enviarEstadoCuentaEmail({ clienteId: "cli-6" })).rejects.toThrow(
      "El cliente no tiene contactos con correo.",
    );
  });

  it("Ola v16 (5): cae al mensaje de transporte si el body no es JSON", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response("<html>502</html>", { status: 502 }),
      },
    });

    await expect(enviarEstadoCuentaEmail({ clienteId: "cli-7" })).rejects.toThrow(
      "Edge Function returned a non-2xx status code",
    );
  });
});
