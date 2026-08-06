import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { FilaEntrada } from "./FilaEntrada";
import { type BitacoraEntrada } from "@/types/bitacora";

interface VirtualTimelineProps {
  entradas: BitacoraEntrada[];
  maxHeight?: number | string;
  mostrarUsuario?: boolean;
}

export function VirtualTimeline({ entradas, maxHeight = 400, mostrarUsuario = false }: VirtualTimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entradas.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto scrollbar-thin"
      style={{ maxHeight }}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
        {virtualizer.getVirtualItems().map((vi) => {
          const entrada = entradas[vi.index];
          return (
            <div
              key={entrada.id}
              ref={virtualizer.measureElement}
              data-index={vi.index}
              className="absolute top-0 left-6 right-0 pb-5"
              style={{
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <FilaEntrada entrada={entrada} mostrarUsuario={mostrarUsuario} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
