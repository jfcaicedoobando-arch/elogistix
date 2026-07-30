import { CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { ActividadItem } from "@/features/embarques/components/ActividadItem";
import type { ActividadGrupo } from "@/features/embarques/domain/actividadFeed";



interface Props {
  grupos: ActividadGrupo[];
}

export function ActividadTimeline({ grupos }: Props) {
  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
        <section key={grupo.dia} className="space-y-3">
          <div className="flex items-center gap-2 sticky top-0 bg-background/95 py-1 z-10">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatDate(grupo.dia, "EEEE dd/MM/yyyy")}
            </h3>
            <span className="text-xs text-muted-foreground">· {grupo.items.length}</span>
          </div>
          <ol className="relative space-y-3 border-l border-border pl-4">
            {grupo.items.map((item) => (
              <ActividadItem key={item.id} item={item} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
