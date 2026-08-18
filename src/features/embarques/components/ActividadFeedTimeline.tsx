import { CalendarDays } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatDate } from "@/lib/formatters";
import { ActividadItem } from "@/features/embarques/components/ActividadItem";
import type { ActividadGrupo } from "@/features/embarques/domain/actividadFeed";



interface Props {
  grupos: ActividadGrupo[];
}

export function ActividadFeedTimeline({ grupos }: Props) {
  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
        <section key={grupo.dia} className="space-y-3">
          <div className="sticky top-0 bg-background/95 py-1 z-10">
            <SectionHeading
              as="h3"
              variant="overline"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              count={grupo.items.length}
            >
              {formatDate(grupo.dia, "EEEE dd/MM/yyyy")}
            </SectionHeading>
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
