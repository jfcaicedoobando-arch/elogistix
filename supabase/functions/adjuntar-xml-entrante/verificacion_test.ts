import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { discrepanciasMeta, type MetaServidor } from "./verificacion.ts";

const SERVIDOR: MetaServidor = {
  uuid: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
  rfcEmisor: "AAA010101AAA",
  folioSerie: "A-100",
  fechaEmision: "2026-08-01",
  total: 1160.5,
  subtotal: 1000,
  moneda: "MXN",
};

Deno.test("sin declaración no hay discrepancias", () => {
  assertEquals(discrepanciasMeta(null, SERVIDOR), []);
});

Deno.test("declaración coincidente (case-insensitive y centavo de tolerancia)", () => {
  assertEquals(
    discrepanciasMeta(
      { uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", rfcEmisor: "aaa010101aaa", total: 1160.5, moneda: "mxn" },
      SERVIDOR,
    ),
    [],
  );
});

Deno.test("UUID de otro CFDI se detecta", () => {
  assertEquals(
    discrepanciasMeta({ uuid: "11111111-2222-3333-4444-555555555555" }, SERVIDOR),
    ["uuid_fiscal"],
  );
});

Deno.test("RFC, moneda y total manipulados se detectan", () => {
  assertEquals(
    discrepanciasMeta({ rfcEmisor: "XXX010101XXX", moneda: "USD", total: 100 }, SERVIDOR),
    ["rfc_emisor", "moneda", "total"],
  );
});
