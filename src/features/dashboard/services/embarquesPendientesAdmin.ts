/**
 * Servicio: embarques pendientes de cierre administrativo.
 * Encapsula el acceso a `@/integrations/supabase/client` para que los hooks
 * cumplan la regla de arquitectura Pages → Hooks → Services → Lib.
 */
import { differenceInDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/** v13.380.0 — `Por liquidar` se suma al pendiente administrativo. */
export type EstadoPendienteAdmin = "Entregado" | "EIR" | "Por liquidar";

export interface EmbarquePendienteAdminItem {
  id: string;
  expediente: string | null;
  cliente_nombre: string;
  estado: EstadoPendienteAdmin;
  diasEnEstado: number;
}

export interface EmbarquesPendientesAdminData {
  entregadosCount: number;
  eirCount: number;
  porLiquidarCount: number;
  topAntiguos: EmbarquePendienteAdminItem[];
}

const COLUMNS = "id, expediente, cliente_nombre, estado, updated_at";
const ESTADOS = ["Entregado", "EIR", "Por liquidar"] as const satisfies readonly EstadoPendienteAdmin[];

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  try {
    return Math.max(0, differenceInDays(new Date(), parseISO(iso)));
  } catch {
    return 0;
  }
}

export async function fetchEmbarquesPendientesAdmin(): Promise<EmbarquesPendientesAdminData> {
  const { data, error } = await supabase
    .from("embarques")
    .select(COLUMNS)
    .in("estado", ESTADOS)
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    expediente: string | null;
    cliente_nombre: string | null;
    estado: string;
    updated_at: string | null;
  }>;

  let entregadosCount = 0;
  let eirCount = 0;
  for (const r of rows) {
    if (r.estado === "Entregado") entregadosCount += 1;
    else if (r.estado === "EIR") eirCount += 1;
  }

  const topAntiguos: EmbarquePendienteAdminItem[] = rows.slice(0, 10).map((r) => ({
    id: r.id,
    expediente: r.expediente,
    cliente_nombre: r.cliente_nombre ?? "—",
    estado: r.estado as "Entregado" | "EIR",
    diasEnEstado: diasDesde(r.updated_at),
  }));

  return { entregadosCount, eirCount, topAntiguos };
}
