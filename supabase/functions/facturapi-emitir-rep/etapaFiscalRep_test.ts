/**
 * Caracterización de la etapa fiscal del REP (extraída de `index.ts`).
 * Cubre: mezcla IVA 16% + "No objeto" (ObjetoImp 01), lectura de conceptos
 * fallida, tratamiento indeterminado y retenciones sin importes.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolverFiscalDr, resolverFiscalRep } from "./etapaFiscal.ts";
import { MSG_REP_CONCEPTOS_ILEGIBLES, MSG_REP_TRATAMIENTO_INDETERMINADO } from "./trasladoDr.ts";
import { MSG_RETENCIONES_SIN_IMPORTES } from "./retencionesDr.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.test("mezcla 16% + No objeto: ObjetoImpDR 02, grupo 16% y no objeto en el denominador", () => {
  const r = resolverFiscalDr(
    [
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 1000 },
      { tipo_iva: "no_objeto", tasa_iva_aplicada: null, total: 200 },
    ],
    { subtotal: 1200, iva: 160 },
  );
  assert(r.ok);
  assertEquals(r.fiscal.objetoImpDr, "02");
  assertEquals(r.fiscal.hayNoObjeto, true);
  assertEquals(r.fiscal.importeNoObjeto, 200);
  assertEquals(r.fiscal.gruposIva, [{ tasa: 0.16, factor: "Tasa", importe: 1000 }]);
  assertEquals(r.fiscal.tasaIvaDr, 0.16);
});

Deno.test("tratamiento indeterminado: corte 422 sin tocar al proveedor", () => {
  const r = resolverFiscalDr([{ tipo_iva: null, tasa_iva_aplicada: null, total: 500 }], { subtotal: 0, iva: 0 });
  assert(!r.ok);
  assertEquals(r.corte.codigo, "iva_tratamiento_indeterminado");
  assertEquals(r.corte.status, 422);
  assertEquals(r.corte.message, MSG_REP_TRATAMIENTO_INDETERMINADO);
});

Deno.test("retenciones sin importes: corte 422 antes del claim", () => {
  const r = resolverFiscalDr(
    [{ tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 0, tasa_ret_iva: 0.04 }],
    { subtotal: 0, iva: 0 },
  );
  assert(!r.ok);
  assertEquals(r.corte.codigo, "retenciones_sin_importes");
  assertEquals(r.corte.message, MSG_RETENCIONES_SIN_IMPORTES);
});

Deno.test("lectura de conceptos fallida: 503 y estado_rep Error (no se infiere del encabezado)", async () => {
  const updates: Record<string, unknown>[] = [];
  const supabase = {
    from: (tabla: string) => ({
      select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: null, error: { message: "timeout" } }) }) }),
      update: (patch: Record<string, unknown>) => {
        updates.push({ tabla, ...patch });
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    }),
  } as unknown as Parameters<typeof resolverFiscalRep>[0];

  const etapa = await resolverFiscalRep(supabase, { id: "f1", subtotal: 1000, iva: 160 }, "pago-1", json);
  assert(!etapa.ok);
  assertEquals(etapa.response.status, 503);
  const body = await etapa.response.json();
  assertEquals(body.error, "conceptos_no_legibles");
  assertEquals(body.message, MSG_REP_CONCEPTOS_ILEGIBLES);
  assertEquals(body.detail, "timeout");
  assertEquals(updates, [{ tabla: "pagos_factura", estado_rep: "Error", rep_error: MSG_REP_CONCEPTOS_ILEGIBLES }]);
});
