import { ArrowRight, Sparkles, UserPlus, FileText, Target, AlarmClock, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import type { NbaIcono, NbaItem } from "@/features/crm/domain/nextBestActions";

const ICONS: Record<NbaIcono, typeof UserPlus> = {
  lead: UserPlus,
  cotizacion: FileText,
  cierre: Target,
  stale: AlarmClock,
  actividad: ClipboardList,
};

interface Props {
  items: NbaItem[];
  isLoading: boolean;
}

export function NextBestActionsCard({ items, isLoading }: Props) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Qué hacer ahora
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-3">Calculando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todo al día. No hay acciones urgentes ahora.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => {
              const Icon = ICONS[it.icono] ?? Sparkles;
              return (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">{it.subtitulo}</p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={it.href}>
                      Ir <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
