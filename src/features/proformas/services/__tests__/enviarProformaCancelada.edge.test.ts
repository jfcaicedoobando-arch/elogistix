import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const proforma = "10000000-0000-4000-8000-000000000001";
const intento = "10000000-0000-4000-8000-000000000002";
const contenido = {
  token: "token", enlace: "https://fixture.invalid/portal/proformas/token", expira: "2099-01-01",
  total_mxn: 116, total_usd: 0,
};

function entorno(estado = "reservado", cancelarAntesEntregar = false) {
  const confirmados = new Set<string>();
  const entrega = vi.fn(async (_admin: unknown, args: { messageId: string; recipientEmail: string }) => {
    confirmados.add(args.messageId);
    return { ok: true };
  });
  const rpc = vi.fn(async (nombre: string) => ({
    data: nombre === "reservar_proforma_email"
      ? { estado, contenido }
      : { success: confirmados.size > 0, estado: cancelarAntesEntregar ? "fallido" : "enviado" },
    error: null,
  }));
  const admin = { rpc, from(table: string) {
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain, neq: () => chain, gt: () => chain, in: () => chain,
      maybeSingle: async () => ({ data: cancelarAntesEntregar ? null : { id: proforma }, error: null }),
      then: (fn: (value: unknown) => unknown) => Promise.resolve({
        data: table === "email_send_log" ? [...confirmados].map((message_id) => ({ message_id })) : [],
        error: null,
      }).then(fn),
    };
    return chain;
  } };
  let handler!: (req: Request) => Promise<Response>;
  const src = readFileSync("supabase/functions/enviar-proforma-email/index.ts", "utf8");
  const compiled = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/^import .*?;\s*$/gm, "").replace(/^export \{\};?\s*$/gm, "");
  runInNewContext(compiled, {
    Deno: { env: { get: (key: string) => key === "SUPABASE_ANON_KEY" ? "anon-fixture" : "synthetic" }, serve: (fn: typeof handler) => { handler = fn; } },
    createClient: (_url: string, key: string) => key === "anon-fixture"
      ? { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } } : admin,
    wrapEdgeHandler: (_name: string, fn: typeof handler) => fn,
    captureEdgeException: vi.fn(), buildCors: () => ({}), handlePreflightStrict: () => null,
    enviarEmailPlantilla: entrega,
    jsonResponse: (data: unknown, status: number) => new Response(JSON.stringify(data), { status }),
    Date, Intl, crypto, console,
  });
  const enviar = () => handler(new Request("https://fixture.invalid", {
    method: "POST", headers: { Authorization: "Bearer synthetic" },
    body: JSON.stringify({
      proforma_id: proforma, intento_id: intento,
      destinatarios: [{ email: "fixture@example.invalid" }, { email: "second@example.invalid" }],
      cc: ["FIXTURE@example.invalid"],
    }),
  }));
  return { enviar, entrega, rpc };
}

describe("envío recuperable de proformas", () => {
  it.each([["cancelada", 409], ["no_encontrada", 404], ["sin_acceso", 403]])(
    "rechaza proforma %s antes de entregar o registrar el envío",
    async (estado, status) => {
      const { enviar, entrega, rpc } = entorno(estado);
      const response = await enviar();
      expect(response.status).toBe(status);
      if (estado === "cancelada") {
        expect(await response.json()).toMatchObject({ error: expect.stringContaining("LC_PROFORMA_CANCELADA") });
      }
      expect(entrega).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledOnce();
    },
  );

  it("comprueba el estado justo antes de entregar", async () => {
    const { enviar, entrega } = entorno("reservado", true);
    expect(await (await enviar()).json()).toMatchObject({ success: false, estado: "fallido" });
    expect(entrega).not.toHaveBeenCalled();
  });

  it("reintenta sólo el destinatario incierto con la misma clave y evita duplicar CC", async () => {
    const { enviar, entrega } = entorno();
    entrega.mockImplementationOnce(async () => { throw new Error("respuesta incierta"); });
    expect((await enviar()).status).toBe(200);
    expect((await enviar()).status).toBe(200);
    expect((await enviar()).status).toBe(200);
    const llamadas = entrega.mock.calls.map(([, args]) => args);
    expect(llamadas).toEqual([
      expect.objectContaining({ recipientEmail: "fixture@example.invalid", idempotencyKey: "proforma:" + intento + ":1" }),
      expect.objectContaining({ recipientEmail: "fixture@example.invalid", idempotencyKey: "proforma:" + intento + ":1" }),
      expect.objectContaining({ recipientEmail: "second@example.invalid", idempotencyKey: "proforma:" + intento + ":2" }),
    ]);
  });

  it("no vuelve a contactar al proveedor si otra ejecución conserva la reserva", async () => {
    const { enviar, entrega, rpc } = entorno("en_proceso");
    expect((await enviar()).status).toBe(200);
    expect(entrega).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("finalizar_proforma_email", expect.objectContaining({ p_reserva: null }));
  });
});
