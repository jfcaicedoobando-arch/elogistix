/**
 * R3 · P2 — Un error transitorio del SAT no debe revertir `uuid_verificado`.
 * Antes: `uuid_verificado: res.estatus === "Vigente"` para TODOS los estatus,
 * así que un outage del SAT durante el barrido semanal masivo ponía en false
 * banderas legítimas en masa.
 *
 * Run: deno test --no-check supabase/functions/_shared/satBarrido_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { patchVerificacionSat } from "./satBarrido.ts";

Deno.test("veredicto Vigente → uuid_verificado=true", () => {
  assertEquals(patchVerificacionSat("Vigente", "2026-08-24T00:00:00Z"), {
    uuid_verificado: true,
    uuid_estatus_sat: "Vigente",
    uuid_verificado_fecha: "2026-08-24T00:00:00Z",
  });
});

Deno.test("veredicto Cancelado → uuid_verificado=false", () => {
  const patch = patchVerificacionSat("Cancelado", "2026-08-24T00:00:00Z");
  assertEquals(patch.uuid_verificado, false);
});

Deno.test("veredicto No Encontrado → uuid_verificado=false", () => {
  const patch = patchVerificacionSat("No Encontrado", "2026-08-24T00:00:00Z");
  assertEquals(patch.uuid_verificado, false);
});

Deno.test("transitorio Error → NO toca uuid_verificado (sólo estatus y fecha)", () => {
  const patch = patchVerificacionSat("Error", "2026-08-24T00:00:00Z");
  assertEquals("uuid_verificado" in patch, false);
  assertEquals(patch.uuid_estatus_sat, "Error");
  assertEquals(patch.uuid_verificado_fecha, "2026-08-24T00:00:00Z");
});

Deno.test("indeterminado No verificable → NO toca uuid_verificado", () => {
  const patch = patchVerificacionSat("No verificable", "2026-08-24T00:00:00Z");
  assertEquals("uuid_verificado" in patch, false);
});
