import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { confirmado } from "./recordatorioFixtures";
import { consultarDestinatarioRecordatorio, enviarRecordatorioCobranza } from "@/features/cobranza/services/recordatorioCobranzaService";

beforeEach(() => {
  supabaseMock.functions.invoke.mockReset();
});

describe("enviarRecordatorioCobranza", () => {
  it('un backend sin endpoint de confirmación falla sin intentar el envío anterior', async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: new Error('404') });
    await expect(enviarRecordatorioCobranza({ facturaId: 'fact-a', destinatarioConfirmado: confirmado() }))
      .rejects.toThrow('404');
    expect(supabaseMock.functions.invoke.mock.calls.map(([name]) => name)).toEqual(['cxc-recordatorio-confirmar']);
  });

  it('si backend afirma otro destinatario, pide comprobar historial y no reenvía', async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: { ok: true, enviado_a: 'otro@example.test' }, error: null });
    await expect(enviarRecordatorioCobranza({ facturaId: 'fact-a', destinatarioConfirmado: confirmado() }))
      .rejects.toThrow('Revisa el historial antes de reintentar');
    expect(supabaseMock.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it("camino feliz: envía body con canal por defecto y devuelve el resultado", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "cliente@correo.mx" },
      error: null,
    });

    const r = await enviarRecordatorioCobranza({
      facturaId: "fact-1",
      nota: "favor de pagar",
      destinatarioConfirmado: confirmado("cliente@correo.mx"),
    });

    expect(r).toEqual({ ok: true, enviado_a: "cliente@correo.mx" });
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-confirmar",
      {
        body: {
          factura_id: "fact-1",
          nota: "favor de pagar",
          canal: "email",
          confirmacion_version: 2, destinatario_confirmado: confirmado("cliente@correo.mx"),
        },
      },
    );
  });

  it("usa canal explícito cuando se provee", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "x@y.mx" },
      error: null,
    });

    await enviarRecordatorioCobranza({ facturaId: "fact-2", canal: "email", destinatarioConfirmado: confirmado("x@y.mx") });

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-recordatorio-confirmar",
      {
        body: {
          factura_id: "fact-2",
          nota: undefined,
          canal: "email",
          confirmacion_version: 2, destinatario_confirmado: confirmado("x@y.mx"),
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
      enviarRecordatorioCobranza({ facturaId: "fact-3", destinatarioConfirmado: confirmado() }),
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
      enviarRecordatorioCobranza({ facturaId: "fact-7", destinatarioConfirmado: confirmado("x@ajeno.com") }),
    ).rejects.toThrow("El correo no pertenece a los contactos del cliente.");
  });

  it("lanza mensaje genérico cuando ok es falso", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: false },
      error: null,
    });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-4", destinatarioConfirmado: confirmado() }),
    ).rejects.toThrow("No se pudo enviar el recordatorio.");
  });

  it("lanza mensaje genérico cuando falta enviado_a aunque ok sea true", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-5", destinatarioConfirmado: confirmado() }),
    ).rejects.toThrow("No se pudo enviar el recordatorio.");
  });

  it("lanza mensaje genérico cuando data es null", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: null });

    await expect(
      enviarRecordatorioCobranza({ facturaId: "fact-6", destinatarioConfirmado: confirmado() }),
    ).rejects.toThrow("No se pudo enviar el recordatorio.");
  });
});

describe('consulta v2 sin envío', () => {
  it.each([
    { ok: true, factura_id: 'fact-a', destinatario: 'antiguo@example.test' },
    { ok: true, version: 2, factura_id: 'fact-a', destinatario: { email: 'incompleto@example.test' } },
  ])('rechaza backend antiguo o sin identidad completa', async data => {
    supabaseMock.functions.invoke.mockResolvedValue({ data, error: null });
    await expect(consultarDestinatarioRecordatorio('fact-a')).rejects.toThrow('No se pudo consultar');
    expect(supabaseMock.functions.invoke.mock.calls.map(([name]) => name)).toEqual(['cxc-recordatorio-destinatario']);
  });
});
