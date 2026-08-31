/**
 * v13.446.x — Ola 4 · N36: dedupe genérico por hash (archivo o XML) del
 * buzón CxP + cleanup best-effort de storage cuando un insert/update falla.
 * Vive aparte para mantener bajo el tamaño de facturasEntrantesUpload.ts.
 */
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_CXP_INBOX } from "@/features/cxp/services/facturasEntrantes.types";
import {
  BuzonDuplicadoError,
  localizarDuplicadoBuzon,
  mensajeDuplicadoBuzon,
} from "@/features/cxp/services/buzonDuplicado";

export { BuzonDuplicadoError };

/**
 * v13.414.0 — Evita gemelos en el buzón: si ya hay un documento vivo con el
 * mismo hash (archivo principal o XML), no se crea/adjunta otro renglón.
 * v13.819.2 — La ubicación del duplicado la resuelve la RPC canónica
 * `buzon_localizar_duplicado` (origen de verdad, con aislamiento multi-org),
 * y el error viaja con metadatos para que la UI ofrezca "Ver embarque".
 */
export async function validarNoDuplicadoEnBuzon(
  hash: string,
  organizationId: string,
  columna: "archivo_hash" | "xml_hash" = "archivo_hash",
  ctx?: { uuidFiscal?: string | null; embarqueId?: string | null },
): Promise<void> {
  void organizationId; // el alcance por organización lo aplica la RPC.
  const ubicacion = await localizarDuplicadoBuzon({
    hash,
    columna,
    uuidFiscal: ctx?.uuidFiscal ?? null,
    embarqueId: ctx?.embarqueId ?? null,
  });
  if (!ubicacion) return;
  throw new BuzonDuplicadoError(
    mensajeDuplicadoBuzon(ubicacion, columna === "xml_hash"),
    ubicacion,
  );
}



/**
 * N36 (Ola 4): sin este cleanup, los archivos ya subidos a cxp-inbox
 * quedaban huérfanos (sin renglón que los referencie) ante cualquier fallo
 * del insert/update posterior (duplicado por carrera, RLS, red).
 */
export async function limpiarArchivosHuerfanos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET_CXP_INBOX).remove(paths).catch(() => undefined);
}

/**
 * Ola 5 · RG4-7: detecta violaciones de unicidad de Postgres (23505).
 * Con paths content-addressed (por hash), una subida concurrente del MISMO
 * archivo pierde la carrera del INSERT con 23505: su objeto en storage es el
 * MISMO que la fila ganadora referencia, y borrarlo deja un documento vivo
 * sin archivo. Se acepta también el match por mensaje porque PostgREST no
 * siempre propaga `code`.
 */
export function esErrorUnicidad(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key|unique/i.test(error.message ?? "");
}

/**
 * Ola 5 · RG4-7: cleanup seguro. Antes de borrar verifica que NINGUNA fila
 * viva (deleted_at IS NULL) de la organización referencie cada path en
 * archivo_path ni en xml_path — un path content-addressed puede estar
 * compartido con otra fila (subidas concurrentes del mismo archivo).
 * Fail-safe: si la verificación falla NO se borra nada; un objeto huérfano
 * en storage se tolera, un archivo vivo borrado no tiene vuelta atrás.
 */
export async function limpiarArchivosHuerfanosSeguro(
  paths: string[],
  organizationId: string,
): Promise<void> {
  const pendientes = paths.filter(Boolean);
  if (pendientes.length === 0) return;
  try {
    const referenciados = new Set<string>();
    for (const columna of ["archivo_path", "xml_path"] as const) {
      const { data, error } = await supabase
        .from("embarque_facturas_entrantes")
        .select(columna)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .in(columna, pendientes);
      if (error) return;
      for (const fila of (data ?? []) as Array<Record<string, unknown>>) {
        const p = fila[columna];
        if (typeof p === "string" && p) referenciados.add(p);
      }
    }
    await limpiarArchivosHuerfanos(pendientes.filter((p) => !referenciados.has(p)));
  } catch {
    // best-effort: el cleanup nunca rompe el flujo principal.
  }
}
