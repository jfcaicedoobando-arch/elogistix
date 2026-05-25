import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CrmLeadRow } from "./constants";

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
    mutationFn: async (params: {
      lead: CrmLeadRow;
      crearCliente: boolean;
      clienteIdExistente?: string | null;
      nombreOportunidad: string;
      montoEstimado: number;
      moneda: "MXN" | "USD" | "EUR";
      fechaEstimadaCierre?: string | null;
    }) => {
      let clienteId = params.clienteIdExistente ?? null;
      let clienteNombre = "";

      if (params.crearCliente && !clienteId) {
        const { data: clienteNuevo, error: errCli } = await supabase
          .from("clientes")
          .insert({
            nombre: params.lead.empresa,
            email: params.lead.email ?? "",
            telefono: params.lead.telefono ?? "",
            ciudad: params.lead.ciudad ?? "",
            contacto: params.lead.contacto ?? "",
          })
          .select("id, nombre")
          .single();
        if (errCli) throw errCli;
        clienteId = clienteNuevo.id;
        clienteNombre = clienteNuevo.nombre;
      } else if (clienteId) {
        const { data: existente } = await supabase
          .from("clientes")
          .select("nombre")
          .eq("id", clienteId)
          .maybeSingle();
        clienteNombre = existente?.nombre ?? params.lead.empresa;
      }

      const { data: etapa, error: errEt } = await supabase
        .from("crm_etapas_pipeline")
        .select("id, probabilidad_default")
        .eq("tipo", "abierta")
        .eq("activa", true)
        .order("orden", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (errEt) throw errEt;
      if (!etapa) throw new Error("No hay etapas abiertas configuradas en el pipeline.");

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
