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

    // TABS-UX-03 (P2-5): la pestaña activa quedaba tapada por la flecha/fade
    // derecha al terminar la carga asíncrona (cambia el ancho del contenedor).
    // Se desplaza en el eje horizontal SOLO lo necesario, con margen para la
    // flecha, sin `scrollIntoView` (provoca salto vertical) y sin reintentos
    // en bucle: el propio `scroll` recalcula el estado de las flechas.
    const MARGEN = 40;
    const asegurarActivaVisible = () => {
      const activa = el.querySelector<HTMLElement>('[data-state="active"]');
      if (!activa) return;
      const inicio = activa.offsetLeft - MARGEN;
      const fin = activa.offsetLeft + activa.offsetWidth + MARGEN;
      if (inicio < el.scrollLeft) el.scrollLeft = Math.max(inicio, 0);
      else if (fin > el.scrollLeft + el.clientWidth) el.scrollLeft = fin - el.clientWidth;
    };

    const actualizar = () => {
      asegurarActivaVisible();
      updateScrollState();
    };

    actualizar();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", actualizar);
    // TABS-UX-02: el ancho también cambia al colapsar el sidebar o al cargar
    // la tipografía, sin que dispare `resize` en window.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(actualizar) : null;
    ro?.observe(el);
    // La pestaña activa cambia por clic o por la URL: observamos `data-state`
    // en lugar de re-suscribir el efecto en cada render.
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(asegurarActivaVisible)
        : null;
    mo?.observe(el, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", actualizar);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  const scrollBy = (delta: number) => scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });


  return (
    // TABS-UX-01: el espacio de las flechas se reserva FUERA del área
    // desplazable; antes el `pl-8` viajaba con el contenido y la flecha
    // izquierda tapaba el texto de la primera pestaña visible.
    <div
      className={cn(
        "relative",
        canScrollLeft && "pl-8",
        canScrollRight && "pr-8",
      )}
    >
      {canScrollLeft && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Desplazar pestañas hacia la izquierda"
          onClick={() => scrollBy(-160)}
          className="absolute left-0 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full shadow-raised"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <div
        ref={scrollRef}
        className={cn(
          // v13.823.336: sin scrollbar nativo permanente; la affordance son
          // las flechas y el degradado, visibles también en escritorio.
          "w-full overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          // TABS-UX-02: `calc` requiere espacios (escritos con `_` en Tailwind).
          canScrollLeft && "[mask-image:linear-gradient(to_right,transparent_0,black_24px,black_calc(100%_-_24px),transparent_100%)]",
          !canScrollLeft && canScrollRight && "[mask-image:linear-gradient(to_right,black_0,black_calc(100%_-_24px),transparent_100%)]",

        )}
      >
        <TabsList
          className={cn(
            "gap-1 inline-flex w-max flex-nowrap",
          )}
          data-testid="embarque-detalle-tabs"
        >
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
          className="absolute right-0 top-1/2 z-10 h-7 w-7 -translate-y-1/2 rounded-full shadow-raised"
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
