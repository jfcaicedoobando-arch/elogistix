/**
 * Wrapper de TarifaForm para el portal del agente.
 * Inyecta `agenteIdFijo` desde el contexto del agente autenticado y muestra un aviso
 * de "la tarifa queda en borrador". El trigger en BD fuerza estado_aprobacion='borrador'
 * de todas formas; aquí sólo cuidamos la UX.
 */
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { useAgenteContext } from "@/features/portal-agente/hooks";
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
  if (!ctx) return null;

  return (
    <TarifaForm
      open={open}
      onOpenChange={onOpenChange}
      // En duplicar pasamos initial pero SIN tarifaId → es un INSERT nuevo.
      initial={initial}
      tarifaId={modo === "duplicar" ? undefined : tarifaId}
      agenteIdFijo={ctx.agenteId}
      tituloOverride={TITULOS[modo]}
    />
  );
}
