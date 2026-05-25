/**
 * Hooks de Leads (CRM Fase 2).
 *
 * Provee paginación servidor, búsqueda, filtros básicos y mutaciones CRUD.
 * Sigue las convenciones del proyecto: organization_id implícito por RLS +
 * default `current_user_org_id()`, soft-delete vía `deleted_at`.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export type CrmLeadRow = Database["public"]["Tables"]["crm_leads"]["Row"];
export type CrmLeadEstado = Database["public"]["Enums"]["crm_lead_estado"];
export type CrmLeadFuente = Database["public"]["Enums"]["crm_lead_fuente"];

export const LEAD_ESTADOS: CrmLeadEstado[] = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "Descalificado",
  "Convertido",
];

export const LEAD_FUENTES: CrmLeadFuente[] = [
  "Web",
  "Referido",
  "Campaña",
  "Llamada en frío",
  "Evento",
  "Otro",
];

export interface LeadFiltros {
  search?: string;
  estado?: CrmLeadEstado | "todos";
  fuente?: CrmLeadFuente | "todos";
  page?: number;
  pageSize?: number;
}

export interface LeadsResultado {
  data: CrmLeadRow[];
  count: number;
}

const LEAD_COLUMNS =
  "id, empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, interes_modo, vendedor_id, vendedor_email, notas, oportunidad_convertida_id, cliente_convertido_id, created_at, updated_at";

export function useLeads(filtros: LeadFiltros = {}) {
  const {
    search = "",
    estado = "todos",
    fuente = "todos",
    page = 0,
    pageSize = 25,
  } = filtros;

  return useQuery<LeadsResultado>({
    queryKey: ["crm", "leads", { search, estado, fuente, page, pageSize }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("crm_leads")
        .select(LEAD_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(
          `empresa.ilike.${term},contacto.ilike.${term},email.ilike.${term}`,
        );
      }
      if (estado !== "todos") q = q.eq("estado", estado);
      if (fuente !== "todos") q = q.eq("fuente", fuente);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      return { data: (data ?? []) as CrmLeadRow[], count: count ?? 0 };
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery<CrmLeadRow | null>({
    queryKey: ["crm", "leads", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select(LEAD_COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CrmLeadRow | null;
    },
  });
}

export type LeadInput = {
  empresa: string;
  contacto?: string;
  email?: string;
  telefono?: string;
  ciudad?: string;
  pais?: string;
  fuente?: CrmLeadFuente;
  estado?: CrmLeadEstado;
  score?: number;
  interes_modo?: string;
  notas?: string;
  vendedor_id?: string | null;
  vendedor_email?: string;
};

export function useCrearLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: LeadInput) => {
      const payload = {
        empresa: input.empresa,
        contacto: input.contacto ?? "",
        email: input.email ?? "",
        telefono: input.telefono ?? "",
        ciudad: input.ciudad ?? "",
        pais: input.pais ?? "",
        fuente: input.fuente ?? "Otro",
        estado: input.estado ?? "Nuevo",
        score: input.score ?? 3,
        interes_modo: input.interes_modo ?? "",
        notas: input.notas ?? "",
        vendedor_id: input.vendedor_id !== undefined ? input.vendedor_id : (user?.id ?? null),
        vendedor_email: input.vendedor_email ?? user?.email ?? "",
        created_by: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("crm_leads")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}

export function useActualizarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<LeadInput>;
    }) => {
      const { error } = await supabase
        .from("crm_leads")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "leads", "detail", vars.id] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
    },
  });
}

export function useEliminarLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_leads")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
    },
  });
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
