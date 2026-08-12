import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scrubExceptionMessage } from "./sentry.ts";

Deno.test("scrubExceptionMessage redacta query params sensibles", () => {
  assertEquals(
    scrubExceptionMessage("GET https://api.ejemplo.com/x?token=SECRET123 falló"),
    "GET https://api.ejemplo.com/x?token=[Filtered] falló",
  );
  assertEquals(
    scrubExceptionMessage("fetch /v1?a=1&api_key=abc123&b=2 timeout"),
    "fetch /v1?a=1&api_key=[Filtered]&b=2 timeout",
  );
});

Deno.test("scrubExceptionMessage redacta credenciales Bearer", () => {
  assertEquals(
    scrubExceptionMessage("401 con header Bearer eyJhbGciOiJIUzI1NiJ9.abc.def"),
    "401 con header Bearer [Filtered]",
  );
});

Deno.test("scrubExceptionMessage no altera mensajes sin secretos", () => {
  const msg = "No se pudo timbrar la factura F-000123 (SAT 504)";
  assertEquals(scrubExceptionMessage(msg), msg);
});
