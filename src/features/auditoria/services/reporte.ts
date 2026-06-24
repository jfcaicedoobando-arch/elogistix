import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { ReporteAuditoria } from "@/features/auditoria/types";

/**
 * Reporte vacío: usado cuando el caller no tiene permiso global para el RPC
 * (`42501`). Antes esto subía a Sentry como "No autorizado" desde el badge
 * del sidebar (issue JAVASCRIPT-REACT-1F).
 */
const REPORTE_VACIO: ReporteAuditoria = {
  generated_at: new Date(0).toISOString(),
  total_hallazgos: 0,
  por_severidad: { critico: 0, alto: 0, medio: 0 },
  por_regla: {} as ReporteAuditoria["por_regla"],
  hallazgos: [],
};

export async function fetchReporteAuditoria(): Promise<ReporteAuditoria> {
  const { data, error } = await supabase.rpc("auditoria_embarques_org");
  if (error) {
    // Postgres 42501 = insufficient_privilege. El RPC exige rol global
    // admin/operador; usuarios con rol sólo por membresía caen aquí. Para el
    // badge del sidebar es esperado, así que devolvemos vacío sin propagar.
    if ((error as { code?: string }).code === "42501") {
      return REPORTE_VACIO;
    }
    throw error;
  }
  return fromDb<ReporteAuditoria>(data);
}
