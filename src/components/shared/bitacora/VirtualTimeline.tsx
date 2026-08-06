import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EntradaBitacora } from "@/hooks/shared";
import { FilaEntrada } from "./FilaEntrada";

/**
 * Línea de tiempo virtualizada de la bitácora. Los estilos en línea son
 * dinámicos por diseño (alto total y desplazamiento calculados por el
 * virtualizer): no se pueden expresar con clases de Tailwind.
 */
export function VirtualTimeline({
  actividades,
  mostrarUsuario,
  maxHeight,
}: {
  actividades: EntradaBitacora[];
  mostrarUsuario: boolean;
  maxHeight: number;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: actividades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110,
    overscan: 8,
    measureElement:
      typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
        ? (el) => el?.getBoundingClientRect().height ?? 110
        : undefined,
  });
  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="overflow-auto [scrollbar-width:thin] pr-2"
      style={{ maxHeight }}
    >
      <div
        className="relative border-l-2 border-border ml-3 pl-6"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((vi) => {
          const entrada = actividades[vi.index];
          return (
            <div
              key={entrada.id}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              className="absolute left-6 right-0 top-0 pb-5"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <FilaEntrada entrada={entrada} mostrarUsuario={mostrarUsuario} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
