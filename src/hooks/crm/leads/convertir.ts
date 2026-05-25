import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CrmLeadRow } from "./constants";
import { resolveClienteForConversion, fetchPrimeraEtapaAbierta } from "./convertirHelpers";

interface ConvertirParams {
  lead: CrmLeadRow;
  crearCliente: boolean;
  clienteIdExistente?: string | null;
  nombreOportunidad: string;
  montoEstimado: number;
  moneda: "MXN" | "USD" | "EUR";
  fechaEstimadaCierre?: string | null;
}

/**
 * Convierte un lead en (opcional) cliente y oportunidad nueva.
 * - Si `crearCliente` y no existe cliente, inserta uno mínimo con razón social = empresa del lead.
 * - Inserta oportunidad en la primera etapa de tipo 'abierta'.
 * - Marca el lead como 'Convertido' y guarda los IDs resultantes.
 */
export function useConvertirLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: ConvertirParams) => {
      const { clienteId, clienteNombre } = await resolveClienteForConversion(params);
      const etapa = await fetchPrimeraEtapaAbierta();

      const { data: opNueva, error: errOp } = await supabase
        .from("crm_oportunidades")
        .insert({
          nombre: params.nombreOportunidad,
          lead_id: params.lead.id,
          cliente_id: clienteId,
          cliente_nombre: clienteNombre,
          etapa_id: etapa.id,
          probabilidad: etapa.probabilidad_default ?? 0,
          monto_estimado: params.montoEstimado,
          moneda: params.moneda,
          fecha_estimada_cierre: params.fechaEstimadaCierre ?? null,
          vendedor_id: params.lead.vendedor_id ?? user?.id ?? null,
          vendedor_email: params.lead.vendedor_email ?? user?.email ?? "",
          modo: params.lead.interes_modo ?? "",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (errOp) throw errOp;

      const { error: errLead } = await supabase
        .from("crm_leads")
        .update({
          estado: "Convertido",
          cliente_convertido_id: clienteId,
          oportunidad_convertida_id: opNueva.id,
        })
        .eq("id", params.lead.id);
      if (errLead) throw errLead;

      return { clienteId, oportunidadId: opNueva.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
