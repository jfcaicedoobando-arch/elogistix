import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { enviarRecordatorioCobranza } from "@/features/cobranza/services/recordatorioCobranzaService";

beforeEach(() => {
  supabaseMock.functions.invoke.mockReset();
});

describe("enviarRecordatorioCobranza", () => {
  it("camino feliz: envía body con canal por defecto y devuelve el resultado", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "cliente@correo.mx" },
      error: null,
    });

    const r = await enviarRecordatorioCobranza({
      facturaId: "fact-1",
      nota: "favor de pagar",
      contactoEmail: "cliente@correo.mx",
    });

    expect(r).toEqual({ ok: true, enviado_a: "cliente@correo.mx" });
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-enviar",
      {
        body: {
          factura_id: "fact-1",
          nota: "favor de pagar",
          canal: "email",
          contacto_email: "cliente@correo.mx",
        },
      },
    );
  });

  it("usa canal explícito cuando se provee", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "x@y.mx" },
      error: null,
    });

    await enviarRecordatorioCobranza({ facturaId: "fact-2", canal: "email" });

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-enviar",
      {
        body: {
          factura_id: "fact-2",
          nota: undefined,
          canal: "email",
          contacto_email: undefined,
        },
      },
    );
  });

  it("lanza cuando supabase devuelve error de transporte", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-3" }),
    ).rejects.toThrow("boom");
  });

  it("A-3: usa el motivo del body de la Edge Function, no el mensaje técnico", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "El correo no pertenece a los contactos del cliente.",
            code: "DESTINATARIO_NO_PERMITIDO",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      },
    });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-7", contactoEmail: "x@ajeno.com" }),
    ).rejects.toThrow("El correo no pertenece a los contactos del cliente.");
  });

  it("lanza mensaje genérico cuando ok es falso", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: false },
      error: null,
    });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-4" }),
    ).rejects.toThrow("No se pudo enviar el recordatorio.");
  });

  it("lanza mensaje genérico cuando falta enviado_a aunque ok sea true", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-5" }),
    ).rejects.toThrow("No se pudo enviar el recordatorio.");
  });

  it("lanza mensaje genérico cuando data es null", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: null });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-6" }),
    ).rejects.toThrow("No se pudo enviar el recordatorio.");
  });
});
