import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/helpers";
import type { NotaEmbarqueRow } from "@/hooks/useEmbarques";

interface Props {
  notas: NotaEmbarqueRow[];
}

export function TabNotas({ notas }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Actividad y Notas</CardTitle></CardHeader>
      <CardContent>
        {notas.length > 0 ? (
          <div className="space-y-4">
            {notas.map(nota => (
              <div key={nota.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                    nota.tipo === 'cambio_estado' ? 'bg-accent' : nota.tipo === 'nota' ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 w-px bg-border mt-1" />
                </div>
                <div className="pb-4">
                  <p className="font-medium">{nota.contenido}</p>
                  <p className="text-xs text-muted-foreground">{nota.usuario} · {formatDate(nota.fecha)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Sin actividad registrada</p>
        )}
      </CardContent>
    </Card>
  );
}
