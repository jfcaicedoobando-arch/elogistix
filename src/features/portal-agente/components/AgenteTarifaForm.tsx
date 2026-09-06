/**
 * Wrapper de TarifaForm para el portal del agente.
 * Inyecta `agenteIdFijo`, `agenteNombreFijo` y las rutas de la organización vinculada
 * (no usa OrganizationContext porque el usuario agente no es miembro del tenant).
 * El trigger en BD fuerza estado_aprobacion='borrador'.
 */
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { useAgenteContext } from "@/features/portal-agente/hooks";
import { useAgenteTarifaRutas } from "@/features/portal-agente/hooks/useAgenteTarifaRutas";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TarifaInput>;
  tarifaId?: string;
  modo: "crear" | "editar" | "duplicar";
}

const TITULOS: Record<Props["modo"], string> = {
  crear: "Nueva tarifa (queda en borrador)",
  editar: "Editar tarifa (vuelve a borrador)",
  duplicar: "Duplicar tarifa (nueva versión en borrador)",
};

export function AgenteTarifaForm({ open, onOpenChange, initial, tarifaId, modo }: Props) {
  const { data: ctx } = useAgenteContext();

  const { data: rutas = [] } = useAgenteTarifaRutas(ctx?.organizationId, open);

  if (!ctx) return null;

  return (
    <TarifaForm
      open={open}
      onOpenChange={onOpenChange}
      // En duplicar pasamos initial pero SIN tarifaId → es un INSERT nuevo.
      initial={initial}
      tarifaId={modo === "duplicar" ? undefined : tarifaId}
      agenteIdFijo={ctx.agenteId}
      agenteNombreFijo={ctx.agenteNombre}
      tituloOverride={TITULOS[modo]}
      rutasOverride={rutas}
      organizationIdOverride={ctx.organizationId}
    />
  );
}
