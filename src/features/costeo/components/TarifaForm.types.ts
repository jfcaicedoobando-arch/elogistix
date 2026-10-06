import type { TarifaInput } from "@/features/costeo/services/tarifas";
import type { RutaOption } from "./MultiRutaSelect";

export interface TarifaFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Avisa sólo cuando se persistió al menos una tarifa, incluso en un lote parcial. */
  onSaved?: () => void;
  initial?: Partial<TarifaInput>;
  tarifaId?: string;
  /** Si se provee, bloquea el Select de agente y oculta la lógica de selección manual. */
  agenteIdFijo?: string;
  /** Nombre del agente a mostrar como readonly cuando agenteIdFijo está presente. */
  agenteNombreFijo?: string;
  /** Override del título del modal (e.g. cuando es desde el portal del agente). */
  tituloOverride?: string;
  /** Rutas a usar en lugar de useCosteoRutas() (útil cuando no hay OrganizationContext). */
  rutasOverride?: RutaOption[];
  /**
   * Organización dueña de la tarifa cuando no hay OrganizationContext (portal del
   * agente). Sin ella el insert salía con `organization_id` nulo y RLS lo rechazaba.
   */
  organizationIdOverride?: string | null;
}
