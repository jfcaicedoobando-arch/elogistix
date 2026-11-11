import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { procesarEventoWebhook } from "../_shared/facturapi-webhook/procesamiento.ts";
import type { FacturapiWebhookEvent } from "../_shared/facturapi-webhook/helpers.ts";

const invoice = { type: "invoice.canceled", data: { object: { id: "remoto" } } };
const receipt = { type: "receipt.canceled", data: invoice.data };
const facturaLocal = { id: "factura", updated_at: "2026-11-01T03:00:00Z", facturapi_id: "remoto", estado: "Emitida" };
const repLocal = { id: "rep", updated_at: "2026-11-01T03:00:00Z", facturapi_rep_id: "remoto", estado_rep: "Timbrado" };

function fakeDb(options: {
  payload?: FacturapiWebhookEvent;
  estado?: "ocupado" | "terminado";
  factura?: typeof facturaLocal;
  pago?: typeof repLocal;
  fallaLectura?: boolean;
  fallaFinalizacion?: boolean;
} = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const tables: string[] = [];
  const filtros: unknown[][] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      const q = {
        select: () => q,
        eq: (...args: unknown[]) => { filtros.push(args); return q; },
        is: (...args: unknown[]) => { filtros.push(args); return q; },
        async maybeSingle() {
          if (options.fallaLectura) return { error: new Error("falló lectura"), data: null };
          return { data: table === "facturas" ? options.factura : options.pago, error: null };
        },
      };
      return q;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === "reservar_evento_facturapi_webhook") {
        const data = options.estado
          ? { estado: options.estado, resultado: "procesado" }
          : { estado: "tomado", id: "evento-1", token: "token-1", payload: options.payload ?? invoice };
        return { data, error: null };
      }
      if (options.fallaFinalizacion && args.p_resultado === "aplicar") {
        return { data: null, error: new Error("falló transacción") };
      }
      return {
        data: {
          estado: args.p_resultado === "aplicar" ? "procesado" : args.p_resultado,
          motivo: args.p_motivo ?? null, tabla: args.p_tabla ?? null,
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls, tables, filtros };
}

Deno.test("un evento en curso o terminado no vuelve a consultar destinos", async () => {
  for (const estado of ["ocupado", "terminado"] as const) {
    const db = fakeDb({ estado });
    assertEquals((await procesarEventoWebhook(db.client, "org", "remoto", invoice)).estado, estado);
    assertEquals(db.calls.length, 1);
    assertEquals(db.tables, []);
  }
});

Deno.test("la cancelación se entrega a la transacción con la versión y el claim observados", async () => {
  const db = fakeDb({ factura: facturaLocal });
  const r = await procesarEventoWebhook(db.client, "org", "remoto", receipt);
  assertEquals(r.estado, "procesado");
  assertEquals(db.tables, ["facturas"], "se usa el payload reservado, no el de la entrega repetida");
  assertEquals(db.filtros, [["facturapi_id", "remoto"], ["organization_id", "org"], ["deleted_at", null]]);
  const { name, args } = db.calls[1];
  assertEquals(name, "finalizar_evento_facturapi_webhook");
  assertEquals(args.p_resultado, "aplicar");
  assertEquals(args.p_tabla, "facturas");
  assertEquals(args.p_documento_id, facturaLocal.id);
  assertEquals(args.p_version, facturaLocal.updated_at);
  assertEquals(args.p_claim, facturaLocal.facturapi_id);
  assertEquals((args.p_patch as { cancellation_status: string }).cancellation_status, "accepted");
  assertEquals(args.p_token, "token-1");
});

Deno.test("receipt.* busca REP y un aviso invoice.* prueba factura antes de REP", async () => {
  const directo = fakeDb({ payload: receipt, pago: repLocal });
  await procesarEventoWebhook(directo.client, "org", "directo");
  assertEquals(directo.tables, ["pagos_factura"]);
  const compat = fakeDb({ pago: repLocal });
  await procesarEventoWebhook(compat.client, "org", "compat");
  assertEquals(compat.tables, ["facturas", "facturas", "pagos_factura"]);
  assertEquals(compat.calls[1].args.p_tabla, "pagos_factura");
  assertEquals(compat.calls[0].args.p_payload, null, "el cron sólo puede reclamar una entrega persistida");
});

Deno.test("una entrega temprana conserva su reserva como reintentable", async () => {
  const db = fakeDb();
  const r = await procesarEventoWebhook(db.client, "org", "remoto", invoice);
  assertEquals(r.estado, "reintentable");
  assertEquals(db.calls[1].args.p_motivo, "pago_not_found");
});

Deno.test("los errores de lectura o finalización dejan el evento reintentable", async () => {
  for (const opciones of [{ fallaLectura: true }, { fallaFinalizacion: true, factura: facturaLocal }]) {
    const db = fakeDb(opciones);
    const r = await procesarEventoWebhook(db.client, "org", "remoto", invoice);
    assertEquals(r.estado, "reintentable");
    const fallo = db.calls.at(-1)?.args;
    assertEquals(fallo?.p_motivo, "procesamiento_fallido");
    assertEquals(fallo?.p_token, "token-1");
  }
});

Deno.test("una reserva con error de infraestructura no se reconoce como procesada", async () => {
  const client = { rpc: async () => ({ data: null, error: new Error("BD no disponible") }) } as unknown as SupabaseClient;
  await assertRejects(() => procesarEventoWebhook(client, "org", "remoto", invoice), Error, "BD no disponible");
});
