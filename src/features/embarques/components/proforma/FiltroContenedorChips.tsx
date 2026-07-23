/**
 * Chips de filtro por contenedor para el paso de selección de conceptos
 * de la proforma. Solo se muestra si el embarque tiene ≥ 2 contenedores.
 *
 * v12.6.0
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FiltroContenedor } from "@/lib/domain/conceptosPorContenedor";
import type { Tables } from "@/integrations/supabase/types";

type EmbarqueContenedor = Tables<'embarque_contenedores'>;

interface Props {
  contenedores: EmbarqueContenedor[];
  value: FiltroContenedor;
  onChange: (v: FiltroContenedor) => void;
}

export function FiltroContenedorChips({ contenedores, value, onChange }: Props) {
  if (contenedores.length < 2) return null;

  const opciones: Array<{ id: FiltroContenedor; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'generales', label: 'Generales' },
    ...contenedores.map((c) => ({
      id: c.id,
      label: c.numero_contenedor || `Contenedor ${c.orden}`,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      <span className="text-xs text-muted-foreground self-center mr-1">Filtrar por contenedor:</span>
      {opciones.map((op) => {
        const active = value === op.id;
        return (
          <Badge
            key={op.id}
            variant={active ? "default" : "outline"}
            className={cn(
              "cursor-pointer text-xs",
              active ? "" : "hover:bg-muted",
            )}
            onClick={() => onChange(op.id)}
          >
            {op.label}
          </Badge>
        );
      })}
    </div>
  );
}
