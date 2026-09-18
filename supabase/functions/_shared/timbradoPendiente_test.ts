/**
 * P0-A/B — Timbrado pendiente en FacturAPI 5.0.
 *
 * Un `status: "pending"` (o una respuesta sin UUID) NO es un CFDI timbrado:
 * no debe promoverse, ni reintentarse, ni liberar el claim.
 */
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  cuerpoTimbradoPendiente,
  esIdempotencyKeyEnUso,
  esTimbradoPendiente,
  esTimbradoValido,
  marcarTimbradoPendiente,
  MIN_EDAD_LIBERACION_MINUTOS,
  uuidFiscalValido,
} from "./timbradoPendiente.ts";

const UUID = "5f9c1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b";

Deno.test("valid + UUID = timbrado; pending o sin UUID = pendiente", () => {
  assert(esTimbradoValido({ id: "i1", uuid: UUID, status: "valid" }));
  assertFalse(esTimbradoPendiente({ id: "i1", uuid: UUID, status: "valid" }));

  for (const inv of [
    { id: "i1", status: "pending" },
    { id: "i1", uuid: "", status: "pending" },
    { id: "i1", uuid: UUID, status: "processing" },
    { id: "i1", uuid: "no-es-uuid", status: "valid" },
    null,
  ]) {
    assert(esTimbradoPendiente(inv), `debía ser pendiente: ${JSON.stringify(inv)}`);
    assertFalse(esTimbradoValido(inv), `no debía promoverse: ${JSON.stringify(inv)}`);
  }
});

Deno.test("uuidFiscalValido rechaza vacíos y basura", () => {
  assert(uuidFiscalValido(UUID));
  for (const v of ["", " ", "undefined", null, undefined, 123]) assertFalse(uuidFiscalValido(v));
});

Deno.test("el cuerpo 202 marca pendiente y NO invita a reintentar", () => {
  const body = cuerpoTimbradoPendiente({ pendienteId: "inv_1", claimTag: "PENDING:abc" });
  assertEquals(body.outcome, "timbrado_pendiente");
  assertEquals(body.pendiente, true);
  assertEquals(body.reintentable, false);
  assertEquals(body.facturapi_pendiente_id, "inv_1");
  assertEquals(body.external_id, "PENDING:abc");
  assert(String(body.message).length > 20);
});

Deno.test("idempotency_key_in_use se reconoce por código, mensaje o 409", () => {
  assert(esIdempotencyKeyEnUso({ code: "idempotency_key_in_use" }));
  assert(esIdempotencyKeyEnUso({ message: "The idempotency key is already in use" }));
  assert(esIdempotencyKeyEnUso({ message: "idempotency conflict" }, 409));
  assertFalse(esIdempotencyKeyEnUso({ message: "RFC inválido" }, 400));
});

Deno.test("la ventana de liberación supera los reintentos de FacturAPI (~50 min)", () => {
  assert(MIN_EDAD_LIBERACION_MINUTOS >= 50, "liberar antes duplicaría el CFDI");
  assertEquals(MIN_EDAD_LIBERACION_MINUTOS, 60);
});

Deno.test("marcarTimbradoPendiente sólo toca las columnas pendientes y exige el claim", async () => {
  const visto: Record<string, unknown> = {};
  const supabase = {
    from: (tabla: string) => {
      visto.tabla = tabla;
      return {
        update: (patch: Record<string, unknown>) => {
          visto.patch = patch;
          return {
            eq: (c1: string, v1: string) => {
              visto.eq1 = [c1, v1];
              return {
                eq: (c2: string, v2: string) => {
                  visto.eq2 = [c2, v2];
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const res = await marcarTimbradoPendiente({
    supabase, tabla: "facturas", id: "f1",
    claimCol: "facturapi_id", claimTag: "PENDING:abc",
    pendienteIdCol: "facturapi_pendiente_id", pendienteAtCol: "facturapi_pendiente_at",
    pendienteId: "inv_1",
  });

  assertEquals(res.ok, true);
  const patch = visto.patch as Record<string, unknown>;
  assertEquals(patch.facturapi_pendiente_id, "inv_1");
  assert(typeof patch.facturapi_pendiente_at === "string");
  // Nunca se escriben las columnas que la UI lee como CFDI timbrado.
  for (const prohibida of ["estado", "uuid_fiscal", "folio_fiscal", "facturapi_id"]) {
    assertEquals(patch[prohibida], undefined);
  }
  assertEquals(visto.eq1, ["id", "f1"]);
  assertEquals(visto.eq2, ["facturapi_id", "PENDING:abc"]);
});
