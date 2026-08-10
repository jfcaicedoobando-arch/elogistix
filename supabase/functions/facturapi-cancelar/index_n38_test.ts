/**
 * Ola 4 · N38 — resolveSustitutaSnapshot sin filtro de organización.
 * Cubre: (a) el snapshot expone `organizationId`; (b) `index.ts` rechaza con
 * 422 `sustituta_otra_org` cuando la sustituta pertenece a otra organización.
 */
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveSustitutaSnapshot } from "./cancelacion.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("resolveSustitutaSnapshot: incluye organization_id en el select y en el resultado (shape)", () => {
  const cancelacionSource = Deno.readTextFileSync(new URL("./cancelacion.ts", import.meta.url));
  assertStringIncludes(cancelacionSource, "organization_id");
  assertStringIncludes(cancelacionSource, "organizationId: data.organization_id");
  assert(typeof resolveSustitutaSnapshot === "function");
});

Deno.test("index.ts: rechaza sustituta de otra organización con 422 sustituta_otra_org (Ola 4 · N38)", () => {
  assertStringIncludes(indexSource, "sustitutaOrgId");
  assertStringIncludes(indexSource, '"sustituta_otra_org"');
  // El guard debe ejecutarse DESPUÉS de cargar `factura` (para tener
  // factura.organization_id) y ANTES de invocar a FacturAPI.
  const idxCargaFactura = indexSource.indexOf('.from("facturas")');
  const idxGuardCrossOrg = indexSource.indexOf("sustitutaOrgId !== factura.organization_id");
  const idxLlamadaCancel = indexSource.indexOf("facturapi.invoices.cancel");
  assert(idxCargaFactura >= 0 && idxGuardCrossOrg > idxCargaFactura && idxGuardCrossOrg < idxLlamadaCancel,
    "El guard cross-org debe ir después de cargar la factura y antes de llamar a FacturAPI");
});

Deno.test("index.ts: el guard cross-org responde 422 explícito", () => {
  const guardIdx = indexSource.indexOf("sustitutaOrgId !== factura.organization_id");
  const bloque = indexSource.slice(guardIdx, guardIdx + 300);
  assertStringIncludes(bloque, "422");
  assertStringIncludes(bloque, "sustituta_otra_org");
});

Deno.test("resolveSustitutaSnapshot: ok:false cuando la sustituta no tiene uuid_fiscal/facturapi_id", async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: { id: "f1", uuid_fiscal: null, facturapi_id: null, organization_id: "org-a" } };
        },
      };
    },
  } as unknown as Parameters<typeof resolveSustitutaSnapshot>[0];
  const res = await resolveSustitutaSnapshot(fakeSupabase, "f1");
  assertEquals(res.ok, false);
});

Deno.test("resolveSustitutaSnapshot: ok:true devuelve organizationId de la sustituta (cross-org detectable)", async () => {
  const fakeSupabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return {
            data: {
              id: "f-sustituta", uuid_fiscal: "uuid-x", facturapi_id: "fapi-x",
              organization_id: "org-ajena",
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof resolveSustitutaSnapshot>[0];
  const res = await resolveSustitutaSnapshot(fakeSupabase, "f-sustituta");
  assert(res.ok);
  if (res.ok) {
    assertEquals(res.organizationId, "org-ajena");
    // Este es el valor que index.ts compara contra `factura.organization_id`
    // (de OTRA org, distinta a la de la factura a cancelar) para rechazar
    // con 422 sustituta_otra_org.
    assert(res.organizationId !== "org-a-que-cancela");
  }
});
