import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "tracking", label: "Tracking" },
  { value: "documentos", label: "Documentos" },
  { value: "costos", label: "Costos" },
  { value: "garantias", label: "Demoras y Garantías" },
  { value: "seguros", label: "Seguros" },
  { value: "facturacion", label: "Facturación" },
  { value: "conciliacion", label: "Conciliación" },
  { value: "pnl", label: "Utilidad" },
  { value: "cierre", label: "Cierre" },
  { value: "notas", label: "Notas y Actividad" },
] as const;

/**
 * Barra de pestañas del detalle de embarque (11 pestañas).
 *
 * v13.139.18 (F-04 auditoría 3): 11 tabs desbordaban a 2ª línea con flex-wrap.
 * Cambiamos a scroll horizontal nativo con scrollbar fino para mantener todas
 * las tabs en una sola fila sin partir el header.
 * v13.823.25 (fold 692px): máscara de degradado en el borde derecho.
 * v13.823.26 (auditoría scroll poco visible): el scrollbar nativo es
 * demasiado sutil como única affordance. Se agregan degradados en ambos
 * bordes (según haya contenido oculto a cada lado) y flechas de
 * desplazamiento accesibles (`aria-label`) que sólo aparecen cuando hay algo
 * que desplazar; en lg+ todas las pestañas caben y no se muestran.
 */
export function EmbarqueDetalleTabsBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateScrollState = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const scrollBy = (delta: number) => scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <div className="relative">
      {canScrollLeft && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Desplazar pestañas hacia la izquierda"
          onClick={() => scrollBy(-160)}
          className="absolute left-0 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full shadow-raised lg:hidden"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "w-full overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.4)_transparent]",
          canScrollLeft && "[mask-image:linear-gradient(to_right,transparent_0,black_24px,black_calc(100%-24px),transparent_100%)]",
          !canScrollLeft && canScrollRight && "[mask-image:linear-gradient(to_right,black_0,black_calc(100%-24px),transparent_100%)]",
          "lg:[mask-image:none]",
        )}
      >
        <TabsList className="gap-1 inline-flex w-max flex-nowrap" data-testid="embarque-detalle-tabs">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              data-testid={`tab-${tab.value}`}
              className="whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {canScrollRight && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Desplazar pestañas hacia la derecha"
          onClick={() => scrollBy(160)}
          className="absolute right-0 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full shadow-raised lg:hidden"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
