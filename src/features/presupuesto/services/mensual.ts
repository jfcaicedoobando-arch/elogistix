/**
 * Captura del presupuesto mensual: lectura por año + upsert por celda.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

export type PresupuestoMensualRow = Tables<"presupuesto_mensual">;


export async function fetchPresupuestoMensualAnio(
  anio: number,
  organizationId?: string | null,
): Promise<PresupuestoMensualRow[]> {
  const desde = `${anio}-01`;
  const hasta = `${anio}-12`;
  let q = supabase
    .from("presupuesto_mensual")
    .select("*")
    .gte("periodo", desde)
    .lte("periodo", hasta)
    .limit(500);
  // Filtro explícito por organización — consistente con el resto del módulo
  // y defensa en profundidad además de RLS.
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PresupuestoMensualRow[];
}

export interface UpsertCeldaParams {
  categoria_id: string;
  periodo: string;
  monto_mxn: number;
  organization_id: string;
  creado_por?: string | null;
}

export async function upsertCeldaPresupuesto(p: UpsertCeldaParams): Promise<void> {
  const { error } = await supabase
    .from("presupuesto_mensual")
    .upsert(
      {
        categoria_id: p.categoria_id,
        periodo: p.periodo,
        monto_mxn: p.monto_mxn,
        organization_id: p.organization_id,
        creado_por: p.creado_por ?? null,
      },
      { onConflict: "organization_id,categoria_id,periodo" },
    );
  if (error) throw error;
  await registrarActividad({
    modulo: "configuracion",
    accion: "Actualizó presupuesto mensual",
    entidadId: p.categoria_id,
    detalles: { periodo: p.periodo, monto_mxn: p.monto_mxn },
  });
}
