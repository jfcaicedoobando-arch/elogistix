/**
 * Chips de vistas guardadas del pipeline ("Todas", "Mis deals", …).
 * Aplican un set de filtros predefinido con un clic, estilo Salesforce.
 */
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  buildVistasGuardadas,
  detectarVistaActiva,
} from "@/features/crm/domain/oportunidades/vistasGuardadas";
import type { OportunidadesFiltros } from "./oportunidadesFiltersTypes";

interface Props {
  value: OportunidadesFiltros;
  onChange: (next: OportunidadesFiltros) => void;
}

export default function OportunidadesViewChips({ value, onChange }: Props) {
  const { user } = useAuth();
  const vistas = buildVistasGuardadas({ userId: user?.id });
  const activa = detectarVistaActiva(value, vistas);

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Vistas guardadas">
      {vistas
        .filter((v) => v.disponible)
        .map((v) => (
          <Button
            key={v.id}
            type="button"
            size="sm"
            variant={activa === v.id ? "default" : "outline"}
            className="h-7 rounded-full px-3 text-xs"
            aria-pressed={activa === v.id}
            onClick={() => onChange(v.filtros)}
          >
            {v.label}
          </Button>
        ))}
    </div>
  );
}
