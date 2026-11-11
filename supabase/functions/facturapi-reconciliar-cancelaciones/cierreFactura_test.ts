import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cerrarFacturaConAcuse } from "./cierreFactura.ts";

const factura = { id: "factura", organization_id: "organizacion" };
const now = "2026-11-10T20:00:00.000Z";

function fixture(
  acuseError: Error | null = null,
  cierreError: Error | null = null,
) {
  const llamadas: unknown[] = [];
  const respuesta = Promise.resolve({ error: acuseError });
  const update = {
    eq(columna: string, valor: string) {
      llamadas.push(["eq", columna, valor]);
      return this;
    },
    is(columna: string, valor: null) {
      llamadas.push(["is", columna, valor]);
      return this;
    },
    then: respuesta.then.bind(respuesta),
  };
  const supabase = {
    from(tabla: string) {
      assertEquals(tabla, "facturas");
      return {
        update(patch: unknown) {
          llamadas.push(["acuse", patch]);
          return update;
        },
      };
    },
    rpc(nombre: string, args: unknown) {
      llamadas.push([nombre, args]);
      return Promise.resolve({
        error: cierreError,
        data: { estado: "Sustituida" },
      });
    },
  } as unknown as Parameters<typeof cerrarFacturaConAcuse>[0];
  return { supabase, llamadas };
}

Deno.test("el cron escribe el acuse y delega todo el cierre fiscal en la RPC", async () => {
  const { supabase, llamadas } = fixture();
  const cierre = await cerrarFacturaConAcuse(supabase, factura, {
    xml: "<xml/>",
    status: "accepted",
  }, now);
  assertEquals(cierre.estado, "Sustituida");
  assertEquals(llamadas, [
    ["acuse", {
      acuse_cancelacion_status: "accepted",
      acuse_cancelacion_xml: "<xml/>",
      acuse_cancelacion_fecha: now,
    }],
    ["eq", "id", "factura"],
    ["eq", "organization_id", "organizacion"],
    ["is", "deleted_at", null],
    ["cerrar_cancelacion_factura_facturapi", { p_factura_id: "factura" }],
  ]);
});

Deno.test("el cron conserva el acuse respaldado y propaga el rechazo de la RPC", async () => {
  const { supabase, llamadas } = fixture(null, new Error("cierre revertido"));
  await assertRejects(
    () =>
      cerrarFacturaConAcuse(
        supabase,
        factura,
        { xml: null, status: "pending" },
        now,
      ),
    Error,
    "cierre revertido",
  );
  assertEquals(llamadas[0], ["acuse", { acuse_cancelacion_status: "pending" }]);
  assertEquals(llamadas.slice(-2), [
    ["is", "acuse_cancelacion_xml", null],
    ["cerrar_cancelacion_factura_facturapi", { p_factura_id: "factura" }],
  ]);
});

Deno.test("un fallo al persistir el acuse deja el documento elegible para reintento", async () => {
  const { supabase, llamadas } = fixture(new Error("falló acuse"));
  await assertRejects(
    () =>
      cerrarFacturaConAcuse(supabase, factura, {
        xml: "<xml/>",
        status: "accepted",
      }, now),
    Error,
    "falló acuse",
  );
  assertEquals(llamadas.at(-1), ["is", "deleted_at", null]);
});
