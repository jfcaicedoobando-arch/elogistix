/**
 * Subcomponente presentacional: tarjeta del checklist de validaciones de cierre.
 * v13.106.1 — Modo `informativo` para embarques ya cerrados (legacy).
 * v13.361.0 — Checklist agrupado por fase del ciclo de vida del embarque.
 * v13.384.0 — Checks aún no evaluables (sin facturas / sin costos comprobados)
 *              se muestran en gris "No aplica aún".
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CierreChecklistFase } from "./CierreChecklistFase";
import { agruparChecksPorFase } from "@/features/embarques/utils/cierreCheckOrden";
import { calcularReglasNoAplica } from "@/features/embarques/utils/cierreCheckNoAplica";


export interface CierreCheck {
  regla: string;
  ok: boolean;
  detalle?: unknown;
}

interface Props {
  isLoading: boolean;
  checks: CierreCheck[];
  embarqueId: string;
  /** v13.385.0 — Expediente, para enlazar checks a módulos externos. */
  expediente?: string;
  /** Si true, presenta el checklist como referencia (sin badges rojos ni CTAs). */
  informativo?: boolean;
  /** @deprecated — los labels están en `cierreCheckMeta`. */
  etiquetas?: Record<string, string>;
}

export function CierreChecklistCard({ isLoading, checks, embarqueId, expediente, informativo = false }: Props) {
  const noAplica = calcularReglasNoAplica(checks);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {informativo ? "Checklist de cierre (informativo)" : "Checklist de cierre"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {informativo && (
          <p className="text-xs text-muted-foreground">
            Este embarque se cerró antes de que existieran algunas de estas reglas.
            La lista es solo referencial; no requiere acción.
          </p>
        )}
        {isLoading && <p className="text-sm text-muted-foreground">Validando…</p>}
        {!isLoading && checks.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        )}
        <div className="space-y-4">
          {agruparChecksPorFase(checks).map((grupo) => (
            <CierreChecklistFase
              key={grupo.fase.id}
              grupo={grupo}
              embarqueId={embarqueId}
              expediente={expediente}
              informativo={informativo}
              noAplica={noAplica}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
