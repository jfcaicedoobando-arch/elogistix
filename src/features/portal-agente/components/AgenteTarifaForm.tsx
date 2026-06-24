/**
 * Wrapper de TarifaForm para el portal del agente.
 * Inyecta `agenteIdFijo`, `agenteNombreFijo` y las rutas de la organización vinculada
 * (no usa OrganizationContext porque el usuario agente no es miembro del tenant).
 * El trigger en BD fuerza estado_aprobacion='borrador'.
 */
import { useQuery } from "@tanstack/react-query";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { useAgenteContext } from "@/features/portal-agente/hooks";
import { fetchAgenteRutas } from "@/features/portal-agente/services";
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

  const { data: rutas = [] } = useQuery({
    queryKey: ["portal-agente", "rutas", ctx?.organizationId],
    queryFn: () => fetchCosteoRutas(ctx!.organizationId),
    enabled: !!ctx?.organizationId && open,
    staleTime: 5 * 60 * 1000,
  });

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
    />
  );
}
