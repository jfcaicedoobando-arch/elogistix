import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORIA_LABEL, type ActividadCategoria } from "@/features/embarques/domain/actividadFeed";

const ORDEN: ActividadCategoria[] = ["operacion", "comercial", "finanzas", "riesgo", "cierre"];

interface Props {
  conteos: Record<string, number>;
  categoria: ActividadCategoria | "todos";
  onChange: (c: ActividadCategoria | "todos") => void;
}

export function ActividadFiltros({ conteos, categoria, onChange }: Props) {
  const total = Object.values(conteos).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const disponibles = ORDEN.filter((c) => (conteos[c] ?? 0) > 0);

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar actividad">
      <Chip activo={categoria === "todos"} onClick={() => onChange("todos")}>
        Todo · {total}
      </Chip>
      {disponibles.map((c) => (
        <Chip key={c} activo={categoria === c} onClick={() => onChange(c)}>
          {CATEGORIA_LABEL[c]} · {conteos[c]}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={activo ? "default" : "outline"}
      aria-pressed={activo}
      onClick={onClick}
      className={cn("h-7 rounded-full px-3 text-xs")}
    >
      {children}
    </Button>
  );
}
