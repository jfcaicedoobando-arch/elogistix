import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  MOTIVOS_VALIDOS,
  buildCancelQuery,
  validateCancelacionInput,
} from "./helpers.ts";

Deno.test("MOTIVOS_VALIDOS contiene exactamente los 4 motivos SAT", () => {
  assertEquals([...MOTIVOS_VALIDOS].sort(), ["01", "02", "03", "04"]);
});

Deno.test("validateCancelacionInput rechaza factura_id ausente", () => {
  const r = validateCancelacionInput({ motivo: "02" });
  assert(!r.ok && r.error === "factura_id_required");
});

Deno.test("validateCancelacionInput rechaza motivo no permitido", () => {
  const r = validateCancelacionInput({ factura_id: "f1", motivo: "99" });
  assert(!r.ok && r.error === "motivo_invalido");
});

Deno.test("validateCancelacionInput rechaza motivo ausente", () => {
  const r = validateCancelacionInput({ factura_id: "f1" });
  assert(!r.ok && r.error === "motivo_invalido");
});

Deno.test("validateCancelacionInput exige sustituye_uuid en motivo 01", () => {
  const r = validateCancelacionInput({ factura_id: "f1", motivo: "01" });
  assert(!r.ok && r.error === "sustituye_uuid_requerido");
});

Deno.test("validateCancelacionInput acepta motivo 01 con sustituye_uuid", () => {
  const r = validateCancelacionInput({ factura_id: "f1", motivo: "01", sustituye_uuid: "UUID-1" });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.data.motivo, "01");
    assertEquals(r.data.sustituye_uuid, "UUID-1");
  }
});

Deno.test("validateCancelacionInput acepta motivos 02/03/04 sin sustituye_uuid", () => {
  for (const m of ["02", "03", "04"]) {
    const r = validateCancelacionInput({ factura_id: "f1", motivo: m });
    assert(r.ok, `motivo ${m} debería ser válido`);
  }
});

Deno.test("buildCancelQuery omite substitution cuando no hay UUID", () => {
  assertEquals(buildCancelQuery("02"), "motive=02");
});

Deno.test("buildCancelQuery incluye substitution cuando se pasa UUID", () => {
  const q = buildCancelQuery("01", "UUID-ABC");
  assert(q.includes("motive=01"));
  assert(q.includes("substitution=UUID-ABC"));
});
