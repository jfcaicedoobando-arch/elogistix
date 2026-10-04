import { supabase } from "@/integrations/supabase/client";
import type { MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import {
  clasificarRevisionImportacion, moverDiaImportacion, type EspejoImportacion,
  type ResumenRevisionImportacion,
} from "@/features/tesoreria/domain/import/revisionImportacion";

export interface CuentaRevisionImportacion { id: string; alias: string; banco: string; moneda: string }
export interface RevisionImportacion { cuenta: CuentaRevisionImportacion; resumen: ResumenRevisionImportacion }
const CHUNK = 500;
const MAX_ESPEJOS = 20_000;

async function leerHashesExistentes(cuentaId: string, movimientos: MovimientoParseado[]) {
  const hashes = new Set<string>();
  for (let inicio = 0; inicio < movimientos.length; inicio += CHUNK) {
    const { data, error } = await supabase.from("bbva_movimientos").select("hash_dedupe")
      .eq("cuenta_bancaria_id", cuentaId).is("deleted_at", null)
      .in("hash_dedupe", movimientos.slice(inicio, inicio + CHUNK).map((m) => m.hash_dedupe));
    if (error) throw error;
    for (const m of data ?? []) hashes.add(m.hash_dedupe);
  }
  return hashes;
}

async function leerEspejos(cuentaId: string, desde: string, hasta: string): Promise<EspejoImportacion[]> {
  const espejos: EspejoImportacion[] = [];
  for (let inicio = 0; inicio < MAX_ESPEJOS; inicio += CHUNK) {
    const { data, error } = await supabase.from("bbva_movimientos")
      .select("id,cuenta_bancaria_id,hash_dedupe,pago_factura_id,fecha,cargo,abono")
      .eq("cuenta_bancaria_id", cuentaId).is("deleted_at", null).like("hash_dedupe", "cobro-%")
      .not("pago_factura_id", "is", null).gte("fecha", moverDiaImportacion(desde, -3))
      .lte("fecha", moverDiaImportacion(hasta, 3)).order("id").range(inicio, inicio + CHUNK - 1);
    if (error) throw error;
    espejos.push(...(data ?? []));
    if ((data?.length ?? 0) < CHUNK) return espejos;
  }
  throw new Error("La revisión tiene demasiadas coincidencias. Acota el periodo del archivo antes de importar.");
}

/** Sólo SELECTs: preparar una revisión nunca absorbe espejos ni inserta filas. */
export async function revisarImportacion(cuentaId: string, movimientos: MovimientoParseado[]): Promise<RevisionImportacion> {
  const { data: cuenta, error } = await supabase.from("cuentas_bancarias")
    .select("id,alias,banco,moneda,activa").eq("id", cuentaId).is("deleted_at", null).single();
  if (error) throw error;
  if (!cuenta.activa) throw new Error("La cuenta elegida está inactiva. Selecciona una cuenta activa para revisar el archivo.");
  const fechas = movimientos.map((m) => m.fecha).sort();
  if (!fechas.length) throw new Error("No hay movimientos para revisar.");
  const hashes = await leerHashesExistentes(cuentaId, movimientos);
  const espejos = await leerEspejos(cuentaId, fechas[0], fechas.at(-1)!);
  return { cuenta, resumen: clasificarRevisionImportacion(movimientos, hashes, espejos) };
}
