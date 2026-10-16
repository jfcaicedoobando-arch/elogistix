/**
 * Estado de la empresa en el CRM: Lead → Sospechoso (fuera del embudo) → Prospecto (entra al
 * embudo en la etapa Prospecto) → Cliente (dada de alta en Clientes).
 */
import { supabase } from "@/integrations/supabase/client";

export const ESTADOS_EMPRESA_CRM = ["Lead", "Sospechoso", "Prospecto", "Cliente"] as const;
export type EstadoEmpresaCrm = (typeof ESTADOS_EMPRESA_CRM)[number];
export const FILTRO_ESTADO_EMPRESA = ["todos", ...ESTADOS_EMPRESA_CRM] as const;
export type FiltroEstadoEmpresa = (typeof FILTRO_ESTADO_EMPRESA)[number];

/** Normaliza el valor de la base; si falta, se deduce del alta a Clientes. */
export function estadoEmpresa(fila: { estado_crm?: string | null; cliente_id: string | null }): EstadoEmpresaCrm {
  const v = fila.estado_crm;
  if (v === "Lead" || v === "Sospechoso" || v === "Prospecto" || v === "Cliente") return v;
  return fila.cliente_id ? "Cliente" : "Lead";
}

type RpcSinTipos = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;

const ERRORES_PROSPECTO: Record<string, string> = {
  LC_CRM_PROSPECTO_NO_AUTORIZADO: "Sólo puedes pasar a prospecto empresas creadas por ti y asignadas a tu usuario en la organización activa.",
  LC_CRM_PROSPECTO_VINCULO_INVALIDO: "El lead o las oportunidades vinculadas no están vigentes o no corresponden a tu usuario, empresa y organización. Revisa sus vínculos.",
  LC_CRM_EMPRESA_YA_CLIENTE: "La empresa ya es cliente y no puede pasar a prospecto.",
};

/** Pasa la empresa a Prospecto y devuelve la oportunidad creada o reutilizada. */
export async function pasarAProspecto(empresaId: string): Promise<string> {
  // SAFE-CAST: la RPC llega con la migración del borrador; los tipos se regeneran al aceptarla.
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcSinTipos;
  const { data, error } = await rpc("crm_empresa_pasar_a_prospecto", { p_empresa_id: empresaId });
  if (error) {
    const mensaje = ERRORES_PROSPECTO[error.message];
    if (mensaje) throw new Error(mensaje, { cause: error });
    throw error;
  }
  const id = (data as { oportunidad_id?: string } | null)?.oportunidad_id;
  if (!id) throw new Error("No se pudo crear la oportunidad de la empresa");
  return id;
}
