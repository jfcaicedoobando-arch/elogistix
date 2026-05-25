import type { EntradaBitacora } from "@/hooks/shared";
import { FilaEntrada } from "./bitacora/FilaEntrada";
import { VirtualTimeline } from "./bitacora/VirtualTimeline";

interface Props {
  actividades: EntradaBitacora[];
  mostrarUsuario?: boolean;
  /** Activa virtualización con @tanstack/react-virtual. Útil cuando hay
   *  cientos de filas y el usuario sube `pageSize` por encima del default. */
  virtualize?: boolean;
  /** Altura máxima del viewport virtualizado en px (default 600). */
  maxHeight?: number;
}

export function BitacoraActividad({
  actividades,
  mostrarUsuario = true,
  virtualize = false,
  maxHeight = 600,
}: Props) {
  if (actividades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Sin actividad registrada
      </p>
    );
  }

  if (!virtualize) {
    return (
      <div className="relative border-l-2 border-border ml-3 space-y-5 pl-6">
        {actividades.map((entrada) => (
          <FilaEntrada
            key={entrada.id}
            entrada={entrada}
            mostrarUsuario={mostrarUsuario}
          />
        ))}
      </div>
    );
  }

  return (
    <VirtualTimeline
      actividades={actividades}
      mostrarUsuario={mostrarUsuario}
      maxHeight={maxHeight}
    />
  );
}
