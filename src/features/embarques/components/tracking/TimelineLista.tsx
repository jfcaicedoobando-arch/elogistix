import { formatDate } from "@/lib/formatters";
import { TimelineEventoItem, type TimelineEvento } from "./TimelineEventoItem";

interface Props {
  eventos: TimelineEvento[];
}

interface Grupo {
  dia: string;
  eventos: Array<{ evento: TimelineEvento; indiceGlobal: number }>;
}

/** Agrupa eventos por día conservando el orden recibido (más reciente primero). */
function agruparPorDia(eventos: TimelineEvento[]): Grupo[] {
  const grupos: Grupo[] = [];
  eventos.forEach((evento, indiceGlobal) => {
    const dia = formatDate(evento.fecha, "dd MMM yyyy");
    const ultimoGrupo = grupos[grupos.length - 1];
    if (ultimoGrupo && ultimoGrupo.dia === dia) {
      ultimoGrupo.eventos.push({ evento, indiceGlobal });
    } else {
      grupos.push({ dia, eventos: [{ evento, indiceGlobal }] });
    }
  });
  return grupos;
}

/**
 * Contenedor de la línea de tiempo de eventos: rail vertical alineado al
 * centro de los nodos y encabezado por día.
 */
export function TimelineLista({ eventos }: Props) {
  const grupos = agruparPorDia(eventos);
  return (
    <div className="relative">
      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
      <div className="space-y-5">
        {grupos.map((grupo) => (
          <div key={grupo.dia} className="space-y-4">
            <div className="relative pl-12">
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                {grupo.dia}
              </span>
            </div>
            {grupo.eventos.map(({ evento, indiceGlobal }) => (
              <TimelineEventoItem
                key={`${evento.fecha}-${indiceGlobal}`}
                evento={evento}
                ultimo={indiceGlobal === 0}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
