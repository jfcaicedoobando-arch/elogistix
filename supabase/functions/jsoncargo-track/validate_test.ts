// @ts-nocheck — Deno runtime
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateEmbarqueForTracking, parseBodyId } from "./index.ts";

const base = {
  id: "e1",
  organization_id: "org-1",
  modo: "Marítimo",
  contenedor: "MSCU1234567",
  naviera: "MSC",
} as never;

Deno.test("validateEmbarqueForTracking: rechaza modo no marítimo", () => {
  const r = validateEmbarqueForTracking({ ...base, modo: "Aéreo" });
  assert("errorCode" in r && r.errorCode === "not_maritimo");
});

Deno.test("validateEmbarqueForTracking: rechaza sin contenedor", () => {
  const r = validateEmbarqueForTracking({ ...base, contenedor: null });
  assert("errorCode" in r && r.errorCode === "missing_contenedor");
});

Deno.test("validateEmbarqueForTracking: rechaza naviera no soportada", () => {
  const r = validateEmbarqueForTracking({ ...base, naviera: "DesconocidaXYZ" });
  assert("errorCode" in r && r.errorCode === "naviera_no_soportada");
});

Deno.test("validateEmbarqueForTracking: happy path retorna shippingLine", () => {
  const r = validateEmbarqueForTracking(base);
  assert("ok" in r && r.ok === true);
});

Deno.test("parseBodyId: JSON inválido → null", async () => {
  const req = new Request("https://x/y", { method: "POST", body: "not-json" });
  assertEquals(await parseBodyId(req), null);
});

Deno.test("parseBodyId: sin embarqueId → null", async () => {
  const req = new Request("https://x/y", { method: "POST", body: JSON.stringify({}) });
  assertEquals(await parseBodyId(req), null);
});

Deno.test("parseBodyId: embarqueId string → lo retorna", async () => {
  const req = new Request("https://x/y", {
    method: "POST",
    body: JSON.stringify({ embarqueId: "abc-123" }),
  });
  assertEquals(await parseBodyId(req), "abc-123");
});
