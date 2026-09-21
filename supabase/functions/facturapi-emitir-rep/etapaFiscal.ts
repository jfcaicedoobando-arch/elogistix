/**
 * Etapa 2 — Resolución fiscal del documento relacionado (IVA por grupo, "no
 * objeto" y retenciones).
 *
 * `resolverFiscalDr` es PURA y devuelve un resultado discriminado: o el
 * tratamiento resuelto, o el corte fiscal (código, status y mensaje) que el
 * llamador convierte en `Response`. La parte impura (`resolverFiscalRep`) sólo
 * lee los renglones y marca `estado_rep = "Error"` con el mismo texto de antes.
 *
 * Reglas fiscales, tolerancias y orden de validación son IDÉNTICOS a los que
 * vivían en `index.ts`: error de lectura ≠ factura legacy sin renglones; se
 * falla cerrado ANTES del claim y antes de llamar al PAC.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { leerConceptosDr, type ConceptoDrRow } from "./conceptosFacturaDr.ts";
import { resolverNoObjetoDr } from "./objetoImpDr.ts";
import { resolverGruposRetencionDr, MSG_RETENCIONES_SIN_IMPORTES, type GrupoRetencionDr } from "./retencionesDr.ts";
import {
  MSG_REP_CONCEPTOS_ILEGIBLES,
  MSG_REP_IMPORTES_FALTANTES,
  MSG_REP_TRATAMIENTO_INDETERMINADO,
  trasladoDesdeEncabezado,
  type FactorIvaDr,
  type GrupoTrasladoDr,
} from "./trasladoDr.ts";
import { etapaCorte, etapaOk, type Etapa, type JsonFn } from "./etapaResultado.ts";

export interface FiscalDr {
  /** Tasa del primer grupo (compatibilidad y facturas sin renglones). */
  tasaIvaDr: number;
  factorIvaFactura: FactorIvaDr;
  gruposIva: GrupoTrasladoDr[];
  retenciones: GrupoRetencionDr[];
  objetoImpDr: "01" | "02";
  hayNoObjeto: boolean;
  importeNoObjeto: number;
}

/** Corte fiscal: se persiste en `rep_error` y se responde con este código. */
export interface CorteFiscal {
  codigo: string;
  status: number;
  message: string;
}

export type ResultadoFiscal =
  | { ok: true; fiscal: FiscalDr }
  | { ok: false; corte: CorteFiscal };

export function resolverFiscalDr(
  conceptos: ConceptoDrRow[],
  encabezado: { subtotal: number; iva: number },
): ResultadoFiscal {
  // Un grupo por tratamiento con BaseDR prorrateada (la mezcla 16% + 0% sí se
  // cobra; nunca una tasa promedio). "No objeto" (SAT 01) se declara vía
  // `taxability` del documento relacionado: no causa impuesto, pero su importe
  // entra al denominador del prorrateo.

  const noObjeto = resolverNoObjetoDr(conceptos);
  const { objetoImpDr, hayNoObjeto, gravables, grupos } = noObjeto;
  if (grupos === "sin_importes") {
    return { ok: false, corte: { codigo: "iva_importes_faltantes", status: 422, message: MSG_REP_IMPORTES_FALTANTES } };
  }
  // Tratamiento desconocido o contradictorio: se falla CERRADO antes del claim.
  const respaldo = grupos === "sin_conceptos"
    ? trasladoDesdeEncabezado(encabezado.subtotal, encabezado.iva)
    : null;
  if (grupos === "indeterminado" || (grupos === "sin_conceptos" && respaldo === null)) {
    return {
      ok: false,
      corte: { codigo: "iva_tratamiento_indeterminado", status: 422, message: MSG_REP_TRATAMIENTO_INDETERMINADO },
    };
  }
  const gruposIva: GrupoTrasladoDr[] = Array.isArray(grupos) ? grupos : [];
  // Retenciones del CFDI relacionado: un grupo por impuesto+tasa con la base de
  // sus renglones (los no objeto no admiten retención).
  const retenciones = resolverGruposRetencionDr(gravables);
  if (retenciones === "sin_importes") {
    return {
      ok: false,
      corte: { codigo: "retenciones_sin_importes", status: 422, message: MSG_RETENCIONES_SIN_IMPORTES },
    };
  }
  return {
    ok: true,
    fiscal: {
      tasaIvaDr: gruposIva[0]?.tasa ?? respaldo?.tasa ?? 0,
      factorIvaFactura: gruposIva[0]?.factor ?? respaldo?.factor ?? "Tasa",
      gruposIva,
      retenciones,
      objetoImpDr,
      hayNoObjeto,
      importeNoObjeto: noObjeto.importeNoObjeto,
    },
  };
}

async function marcarErrorRep(supabase: SupabaseClient, pagoId: string, mensaje: string): Promise<void> {
  await supabase.from("pagos_factura")
    .update({ estado_rep: "Error", rep_error: mensaje })
    .eq("id", pagoId);
}

/** Lee los renglones autoritativos y resuelve el tratamiento fiscal. */
export async function resolverFiscalRep(
  supabase: SupabaseClient,
  factura: { id: string; subtotal?: number | null; iva?: number | null },
  pagoId: string,
  json: JsonFn,
): Promise<Etapa<FiscalDr>> {
  // SAFE-CAST: el cliente implementa el subconjunto de query que usa la lectura.
  const lectura = await leerConceptosDr(
    supabase as unknown as Parameters<typeof leerConceptosDr>[0],
    factura.id,
  );
  // Error de LECTURA ≠ factura legacy sin renglones: si la consulta falla no se
  // infiere nada del encabezado (se perderían las retenciones).
  if (!lectura.ok) {
    await marcarErrorRep(supabase, pagoId, MSG_REP_CONCEPTOS_ILEGIBLES);
    return etapaCorte(json(
      { error: "conceptos_no_legibles", message: MSG_REP_CONCEPTOS_ILEGIBLES, detail: lectura.detalle },
      503,
    ));
  }

  const resultado = resolverFiscalDr(lectura.conceptos, {
    subtotal: Number(factura.subtotal ?? 0),
    iva: Number(factura.iva ?? 0),
  });
  if (!resultado.ok) {
    const { codigo, status, message } = resultado.corte;
    await marcarErrorRep(supabase, pagoId, message);
    return etapaCorte(json({ error: codigo, message }, status));
  }
  return etapaOk(resultado.fiscal);
}
