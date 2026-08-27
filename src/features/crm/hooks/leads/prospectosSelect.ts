/**
 * Fase 2 rediseño CRM: prospectos calificados disponibles como ORIGEN de una
 * oportunidad. Sólo lectura acotada (20 filas) para alimentar el combobox.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { listLeads } from "@/features/crm/services/leads";
import { LEAD_ESTADOS_ETAPA_PROSPECTO } from "@/features/crm/domain/leads/etapas";

export interface ProspectoOption {
  id: string;
  empresa: string;
  contacto: string | null;
  estado: string;
  origen: string | null;
  destino: string | null;
  vendedor_id: string | null;
  vendedor_email: string | null;
}

const PAGE_SIZE = 20;

export function useProspectosForSelect(search: string) {
  const term = search.trim();
  return useQuery<ProspectoOption[]>({
    queryKey: queryKeys.crm.prospectos.select(term),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await listLeads({
        search: term,
        estadoIn: LEAD_ESTADOS_ETAPA_PROSPECTO,
        page: 0,
        pageSize: PAGE_SIZE,
        sortKey: "empresa",
        sortDir: "asc",
      });
      return data.map((l) => ({
        id: l.id,
        empresa: l.empresa,
        contacto: l.contacto,
        estado: l.estado,
        origen: l.origen,
        destino: l.destino,
        vendedor_id: l.vendedor_id,
        vendedor_email: l.vendedor_email,
      }));
    },
  });
}
