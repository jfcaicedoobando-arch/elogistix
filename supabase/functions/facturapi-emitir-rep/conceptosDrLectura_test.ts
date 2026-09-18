/**
 * P1 · Auditoría IVA — un error al leer los renglones de la factura NO debe
 * tratarse como "factura legacy sin renglones": si se confunden, el REP se
 * timbra sin las retenciones ISR/IVA reales.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { leerConceptosDr, type ConceptoDrRow } from "./conceptosFacturaDr.ts";
import { resolverGruposRetencionDr } from "./retencionesDr.ts";

/** Respuesta que simula el cliente Supabase (data XOR error). */
interface RespuestaFake {
  data: ConceptoDrRow[] | null;
  error: { message: string } | null;
}

interface QueryFake {
  select(cols: string): QueryFake;
  eq(col: string, val: unknown): QueryFake;
  is(col: string, val: unknown): Promise<RespuestaFake>;
}

interface ClienteFake {
  llamadas: string[];
  from(tabla: string): QueryFake;
}

function clienteFake(resultado: RespuestaFake): ClienteFake {
  const llamadas: string[] = [];
  const q: QueryFake = {
    select() { return q; },
    eq() { return q; },
    is() { llamadas.push("consulta"); return Promise.resolve(resultado); },
  };
  return { llamadas, from(tabla: string) { llamadas.push(`from:${tabla}`); return q; } };
}

Deno.test("error de lectura: no se devuelve lista vacía, se reporta el fallo", async () => {
  const cli = clienteFake({ data: null, error: { message: "timeout de red" } });
  const r = await leerConceptosDr(cli, "f1");
  assertEquals(r.ok, false);
  assertEquals(r.ok === false ? r.detalle : "", "timeout de red");
});

Deno.test("consulta OK con cero filas: fallback legacy permitido", async () => {
  const cli = clienteFake({ data: [], error: null });
  const r = await leerConceptosDr(cli, "f1");
  assertEquals(r, { ok: true, conceptos: [] });
});


Deno.test("consulta OK con renglones: se conservan las retenciones", async () => {
  const cli = clienteFake({
    data: [
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, tasa_ret_iva: 0.04, total: 1000 },
      { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 500 },
    ],
    error: null,
  });
  const r = await leerConceptosDr(cli, "f1");

  assertEquals(r.ok, true);
  const retenciones = resolverGruposRetencionDr(r.ok ? r.conceptos : []);
  // La retención se calcula sobre el renglón que la trae ($1,000), no sobre $1,500.
  assertEquals(retenciones, [{ tipo: "IVA", tasa: 0.04, importe: 1000 }]);
});

Deno.test("si el error se tratara como cero filas, las retenciones se perderían", () => {
  // Documenta el riesgo que cubre el fix: sin renglones no hay retenciones.
  assertEquals(resolverGruposRetencionDr([]), []);
});
