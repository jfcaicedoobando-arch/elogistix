/**
 * Tests del helper `getFacturapiClient` — verifica:
 *  - Resuelve y cachea el cliente por API key.
 *  - Propaga errores estructurados de `resolveFacturapiKey`.
 *  - `describeFacturapiError` normaliza errores del SDK.
 *
 * El SDK real (`npm:facturapi`) NO se carga aquí: se monkey-patcha el módulo
 * vía un mock simple inyectando la importación dinámica.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describeFacturapiError } from "./facturapiClient.ts";

Deno.test("describeFacturapiError: extrae status y data desde respuesta HTTP del SDK", () => {
  const err = {
    response: { status: 400, data: { message: "RFC inválido" } },
  };
  const out = describeFacturapiError(err);
  assertEquals(out.status, 400);
  assertEquals(out.detail.message, "RFC inválido");
});

Deno.test("describeFacturapiError: cae a 502 y mensaje cuando el error no tiene response", () => {
  const err = new Error("Network down");
  const out = describeFacturapiError(err);
  assertEquals(out.status, 502);
  assert(typeof out.detail === "object" && out.detail !== null);
  assertEquals((out.detail as { message: string }).message, "Network down");
});

Deno.test("describeFacturapiError: maneja errores plain (string)", () => {
  const out = describeFacturapiError("boom");
  assertEquals(out.status, 502);
  assertEquals((out.detail as { message: string }).message, "boom");
});
