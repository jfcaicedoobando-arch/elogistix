/**
 * v13.361.0 — Grupo de una fase del checklist de cierre.
 * v13.383.0 — Checks sin facturas aún se muestran en gris "No aplica aún".
 */
import { Badge } from "@/components/ui/badge";
import { CierreCheckItem } from "./CierreCheckItem";
import type { GrupoCierre } from "@/features/embarques/utils/cierreCheckOrden";
import { calcularReglasNoAplica } from "@/features/embarques/utils/cierreCheckNoAplica";

interface Props {
  grupo: GrupoCierre;
  embarqueId: string;
  informativo?: boolean;
}

export function CierreChecklistFase({ grupo, embarqueId, informativo = false }: Props) {
  const noAplicaSet = calcularReglasNoAplica(grupo.checks);
  const evaluables = grupo.checks.filter((c) => !noAplicaSet.has(c.regla));
  const okCount = evaluables.filter((c) => c.ok).length;
  const total = evaluables.length;
  const completa = total > 0 && okCount === total;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {grupo.fase.numero}. {grupo.fase.titulo}
        </h3>
        <Badge variant={completa && !informativo ? "secondary" : "outline"} className="text-2xs">
          {okCount}/{total}
        </Badge>
      </div>
      <ul className="space-y-2">
        {grupo.checks.map((c) => (
          <CierreCheckItem
            key={c.regla}
            regla={c.regla}
            ok={c.ok}
            detalle={c.detalle}
            embarqueId={embarqueId}
            informativo={informativo}
            noAplica={noAplicaSet.has(c.regla)}
          />
        ))}
      </ul>
    </section>
  );
}

