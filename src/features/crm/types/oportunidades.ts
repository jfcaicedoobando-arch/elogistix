/**
 * Tipos compartidos del dominio Oportunidades. Vive en `types/` para poder
 * ser consumido tanto por `services/` (I/O) como por `domain/` (puro) sin
 * crear ciclos ni violar la regla `domain → services` prohibida.
 */
import type { Database } from "@/integrations/supabase/types";

export type CrmOportunidadRow = Database["public"]["Tables"]["crm_oportunidades"]["Row"];
// Ola 19 · paso 5: alias central, no se redeclara la unión.
export type { Moneda } from "@/types/db";

export type OportunidadInput = {
  nombre: string;
  cliente_id?: string | null;
  cliente_nombre?: string;
  lead_id?: string | null;
  etapa_id: string;
  monto_estimado?: number;
  moneda?: Moneda;
  probabilidad?: number;
  // B-034: cierre real de la oportunidad (etapa tipo "ganada").
  valor_real?: number | null;
  fecha_cierre_real?: string | null;
  fecha_estimada_cierre?: string | null;
  modo?: string;
  tipo_carga?: string;
  origen?: string;
  destino?: string;
  notas?: string;
  vendedor_id?: string | null;
  vendedor_email?: string;
  // Ola CRM: metas comerciales por oportunidad.
  monto_meta?: number | null;
  fecha_meta_cierre?: string | null;
  compromiso_nota?: string | null;
  // Mapeo CRM Hunter: margen esperado (%) y riesgos/objeciones.
  margen_pct?: number | null;
  riesgos_objeciones?: string | null;
};

