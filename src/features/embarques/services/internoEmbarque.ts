/**
 * FIX2 · B-1 — Columnas internas de un embarque (PnL de cierre, delta de
 * tarifa, motivo de reapertura y correo del creador).
 *
 * La tabla `embarques` ya NO expone estas columnas a `authenticated`
 * (REVOKE de privilegio de columna) porque RLS filtra filas, no columnas y un
 * usuario del portal podía leerlas con `select=*`. El staff las obtiene por la
 * vista `embarques_interno_v`, que valida membresía de organización y excluye
 * a los roles de portal (`cliente`, `agente_carga`).
 */
import { captureAuthDataScope, AuthOperationChangedError } from "@/lib/auth/authOperationScope";
import { registerSessionCache } from "@/lib/auth/sessionCacheRegistry";
import { supabase } from "@/integrations/supabase/client";

export interface EmbarqueInterno {
  cerrado_snapshot: unknown;
  tarifa_delta_jsonb: unknown;
  reabierto_motivo: string | null;
  created_by_email: string | null;
}

const COLUMNAS_INTERNAS =
  "cerrado_snapshot, tarifa_delta_jsonb, reabierto_motivo, created_by_email" as const;

/**
 * PERF (presión de BD 2026-10-07): la vista cuesta ~200 ms por llamada y el
 * detalle del embarque la pedía 3 veces (hook + tarifa + reconciliación).
 * Se comparte la misma promesa durante unos segundos para que una apertura
 * del detalle genere una sola consulta. Los errores no se guardan.
 */
const VENTANA_MS = 15_000;
const enVuelo = new Map<string, { embarqueId: string; at: number; settled: boolean; p: Promise<EmbarqueInterno | null> }>();
registerSessionCache(() => enVuelo.clear());

/** Limpia la memoria corta (p. ej. tras cerrar/reabrir un embarque). */
export function olvidarEmbarqueInterno(embarqueId?: string): void {
  if (!embarqueId) enVuelo.clear();
  else for (const [key, entry] of enVuelo) {
    if (entry.embarqueId === embarqueId) enVuelo.delete(key);
  }
}

/**
 * Devuelve las columnas internas del embarque, o `null` si el usuario no es
 * staff de la organización (la vista simplemente no devuelve la fila).
 */
export function obtenerEmbarqueInterno(
  embarqueId: string,
  opciones: { fresco?: boolean } = {},
): Promise<EmbarqueInterno | null> {
  const scope = captureAuthDataScope();
  // Never reuse (or request) private data with an unresolved or portal scope.
  if (!scope.userId || !scope.organizationId || !scope.role
    || scope.role === "cliente" || scope.role === "agente_carga") return Promise.resolve(null);
  const key = JSON.stringify([scope.userId, scope.organizationId, scope.role, scope.generation, embarqueId]);
  const previo = enVuelo.get(key);
  if (!opciones.fresco && previo && Date.now() - previo.at < VENTANA_MS) {
    if (!previo.settled) return previo.p;
    // A resolved promise also needs a delivery-time guard on subsequent reads.
    return previo.p.then((data) => {
      scope.assertCurrent();
      if (enVuelo.get(key) !== previo) throw new AuthOperationChangedError();
      return data;
    });
  }
  const p = consultar(embarqueId).then((data) => {
    scope.assertCurrent();
    // Invalidation/fresco must also suppress an earlier in-flight completion.
    const entry = enVuelo.get(key);
    if (entry?.p !== p) throw new AuthOperationChangedError();
    entry.settled = true;
    return data;
  }, (error: unknown) => {
    scope.assertCurrent();
    throw error;
  });
  enVuelo.set(key, { embarqueId, at: Date.now(), settled: false, p });
  void p.catch(() => { if (enVuelo.get(key)?.p === p) enVuelo.delete(key); });
  return p;
}

async function consultar(embarqueId: string): Promise<EmbarqueInterno | null> {
  const { data, error } = await supabase
    .from("embarques_interno_v")
    .select(COLUMNAS_INTERNAS)
    .eq("id", embarqueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    cerrado_snapshot: data.cerrado_snapshot ?? null,
    tarifa_delta_jsonb: data.tarifa_delta_jsonb ?? null,
    reabierto_motivo: data.reabierto_motivo ?? null,
    created_by_email: data.created_by_email ?? null,
  };
}
