/**
 * Importación de movimientos bancarios (extraído de `conciliacion.ts`, Power of 10).
 * Upsert por (cuenta_id, hash_dedupe): reporta nuevas vs duplicadas y deja
 * constancia en bitácora incluso cuando la carga queda incompleta.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import { unwrap } from "@/lib/supabase/response";
import { bitacoraImportarMovimientos } from "./conciliacionBitacora";
import { huellaEspejoImportacion, type FilaRevisionImportacion } from "@/features/tesoreria/domain/import/revisionImportacion";

export interface ImportarResultado {
  total: number;
  nuevos: number;
  duplicados: number;
  vinculados?: number;
}

/**
 * MNY: la importación inserta por trozos. Si un trozo posterior falla, los
 * anteriores YA quedaron guardados: el error informa cuántos se guardaron y
 * cuántos faltan, para que el usuario pueda volver a cargar el mismo archivo
 * (los guardados se detectan como duplicados y no se repiten).
 */
export class ImportacionParcialError extends Error {
  readonly code = "LC_IMPORTACION_PARCIAL" as const;
  constructor(
    readonly guardados: number,
    readonly faltantes: number,
    readonly causa?: unknown,
    readonly vinculados = 0,
  ) {
    super(
      (vinculados > 0
        ? `Importación incompleta: se guardaron ${guardados} movimientos nuevos, se vincularon ${vinculados} movimientos internos y quedaron ${faltantes} nuevos pendientes. `
        : `Importación incompleta: se guardaron ${guardados} movimientos y faltaron ${faltantes}. `) +
        "Vuelve a cargar el mismo archivo: los ya guardados se reconocen como duplicados y no se repiten.",
    );
    this.name = "ImportacionParcialError";
  }
}

const CHUNK = 500;

const trocear = <T,>(arr: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
};

function filasParaAbsorcion(payload: TablesInsert<"bbva_movimientos">[], movimientos: MovimientoParseado[], revision?: FilaRevisionImportacion[]) {
  if (!revision) return payload;
  if (revision.length !== movimientos.length
    || revision.some((r, i) => r.movimiento.hash_dedupe !== movimientos[i].hash_dedupe)) {
    throw new Error("La revisión no corresponde al archivo. Revisa los movimientos de nuevo antes de confirmar.");
  }
  return payload.map((p, i) => ({ ...p, espejo_revisado_id: revision[i].espejo?.id ?? null,
    espejo_revisado_huella: revision[i].espejo ? huellaEspejoImportacion(revision[i].espejo!) : null }));
}

export async function importarMovimientos(
  cuentaBancariaId: string,
  movimientos: MovimientoParseado[],
  userId: string | null,
  revision?: FilaRevisionImportacion[],
): Promise<ImportarResultado> {
  if (movimientos.length === 0) return { total: 0, nuevos: 0, duplicados: 0 };
  const payload: TablesInsert<"bbva_movimientos">[] = movimientos.map((m) => ({
    cuenta_bancaria_id: cuentaBancariaId,
    fecha: m.fecha,
    concepto: m.concepto,
    referencia: m.referencia,
    cargo: m.cargo,
    abono: m.abono,
    saldo: m.saldo,
    hash_dedupe: m.hash_dedupe,
    importado_por: userId,
  }));
  // MNY P1.1: un cobro con cuenta bancaria ya creó su movimiento espejo
  // (`cobro-<pago_id>`). Si el estado de cuenta trae esa MISMA operación con
  // otro hash, antes se insertaba aparte y el saldo la contaba dos veces. La
  // RPC hace que la línea real del banco SUSTITUYA al espejo cuando la
  // coincidencia es inequívoca (misma cuenta, mismo importe, ±3 días y un solo
  // candidato); nunca fusiona coincidencias ambiguas. Tras absorberlo, el hash
  // del archivo ya existe y la deduplicación de abajo lo reconoce, así que
  // re-importar el mismo archivo sigue siendo idempotente.
  const filasRevisadas = filasParaAbsorcion(payload, movimientos, revision);
  const { data: absorcion, error: errorAbsorcion } = await supabase.rpc("absorber_espejos_importacion", {
    p_cuenta_bancaria_id: cuentaBancariaId,
    // SAFE-CAST: la RPC recibe jsonb con las columnas del estado de cuenta.
    p_filas: filasRevisadas as unknown as never,
  });
  if (errorAbsorcion) throw errorAbsorcion;
  const vinculados = absorcion && typeof absorcion === "object" && !Array.isArray(absorcion)
    && typeof absorcion.absorbidos === "number" ? absorcion.absorbidos : 0;
  // Ola 11 · RNF-11: el UNIQUE pasó a índice parcial (sólo vivos,
  // uq_bbva_movimientos_hash_dedupe_vivo) y un índice parcial no sirve de
  // árbitro para ON CONFLICT vía PostgREST. Se deduplica contra los hashes
  // VIVOS y se inserta el resto; un hash en papelera ya NO bloquea la
  // re-importación. Una carrera entre importaciones simultáneas sigue
  // protegida por el índice (23505 → error visible, no duplicado silencioso).
  // A-7 (auditoría v14): con ~10k movimientos, un `.in()` con 10k hashes SHA-1
  // (~410 KB en query string) revienta contra el proxy (400/414) y el insert
  // masivo puede exceder límites de payload. Select e insert van troceados.
  const hashes = payload.map((p) => p.hash_dedupe as string);
  const vistos = new Set<string>();
  for (const trozo of trocear(hashes)) {
    const existentes = await unwrap(
      supabase
        .from("bbva_movimientos")
        .select("hash_dedupe")
        .eq("cuenta_bancaria_id", cuentaBancariaId)
        .is("deleted_at", null)
        .in("hash_dedupe", trozo),
    );
    // Sin límite implícito: cada trozo devuelve a lo sumo CHUNK filas, así que
    // el max-rows de PostgREST (1000) no puede truncar la deduplicación.
    for (const e of existentes) vistos.add(e.hash_dedupe);
  }
  const nuevosPayload = payload.filter((p) => {
    const hash = p.hash_dedupe as string;
    if (vistos.has(hash)) return false;
    vistos.add(hash);
    return true;
  });
  // Duplicados REALES: los que ya existían vivos en la cuenta.
  const duplicadosExistentes = Math.max(0, payload.length - nuevosPayload.length - vinculados);
  let nuevos = 0;
  for (const trozo of trocear(nuevosPayload)) {
    const { data, error } = await supabase
      .from("bbva_movimientos")
      .insert(trozo)
      .select("id");
    if (error) {
      // MNY: éxito parcial explícito. Se deja constancia en bitácora de lo que
      // sí quedó guardado antes de propagar el error con los conteos.
      const faltantes = nuevosPayload.length - nuevos;
      await bitacoraImportarMovimientos(
        cuentaBancariaId, movimientos.length, nuevos, duplicadosExistentes, { faltantes, vinculados },
      );
      throw new ImportacionParcialError(nuevos, faltantes, error, vinculados);
    }
    nuevos += (data ?? []).length;
  }

  await bitacoraImportarMovimientos(
    cuentaBancariaId, movimientos.length, nuevos, duplicadosExistentes, { faltantes: 0, vinculados },
  );
  return { total: movimientos.length, nuevos, duplicados: duplicadosExistentes, ...(vinculados > 0 ? { vinculados } : {}) };
}
