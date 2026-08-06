import { useEffect, useState, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Check, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { usePaso1SectionStatus } from "@/features/cotizacion/hooks/usePaso1SectionStatus";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

interface SectionDef {
  id: string;
  label: string;
  done: boolean;
}

interface Props {
  /** True cuando el modo es marítimo: incluye la sección "Tarifa". */
  esMaritimo: boolean;
  /** Selector del contenedor scrollable que muestra los pasos. */
  scrollRootSelector?: string;
}

/**
 * Sidebar sticky con el avance del Paso 1 del wizard de cotización.
 * - Verde + check = sección completa.
 * - Azul + punto = sección actualmente visible en viewport.
 * - Gris + círculo = pendiente.
 *
 * Visible sólo en desktop (≥ lg); en mobile/tablet los checks por sección
 * ya cubren el feedback.
 */
export default function Paso1ProgressSidebar({ esMaritimo }: Props) {
  const status = usePaso1SectionStatus();
  const { control } = useFormContext<CotizacionFormValues>();
  const tipoEmbarque = useWatch({ control, name: "tipoEmbarque" });
  const esLcl = esMaritimo && tipoEmbarque === "LCL";

  const sections: SectionDef[] = useMemo(() => {
    if (esMaritimo) {
      // v13.47.2 — Mercancía antes de Tarifa; Condiciones comerciales tras Tarifa.
      // v13.299.1 — LCL: la etiqueta cambia a "Flete" (captura manual, sin tarifa vinculada).
      return [
        { id: "seccion-cliente",      label: "Cliente",                    done: status.cliente },
        { id: "seccion-operacion",    label: "Operación",                  done: status.operacion },
        { id: "seccion-ruta",         label: "Ruta",                       done: status.ruta },
        { id: "seccion-mercancia",    label: "Mercancía",                  done: status.mercancia },
        { id: "seccion-tarifa",       label: esLcl ? "Flete" : "Tarifa",   done: status.tarifa },
        { id: "seccion-condiciones",  label: "Condiciones",                done: status.condiciones },
        { id: "seccion-cierre",       label: "Cierre",                     done: status.cierre },
      ];
    }
    return [
      { id: "seccion-cliente",   label: "Cliente",   done: status.cliente },
      { id: "seccion-operacion", label: "Operación", done: status.operacion },
      { id: "seccion-ruta",      label: "Ruta",      done: status.ruta },
      { id: "seccion-mercancia", label: "Mercancía", done: status.mercancia },
      { id: "seccion-cierre",    label: "Cierre",    done: status.cierre },
    ];
  }, [status, esMaritimo, esLcl]);

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Toma la entrada más arriba que esté intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const completas = sections.filter((s) => s.done).length;
  const total = sections.length;
  const pct = Math.round((completas / total) * 100);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className="hidden lg:block sticky top-4 self-start w-56 shrink-0">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="space-y-1">
          <SectionHeading as="h3">Progreso del Paso 1</SectionHeading>
          <p className="text-xs text-muted-foreground">
            {completas} de {total} completas
          </p>
          <Progress value={pct} className="h-1.5" />
        </div>
        <nav className="space-y-1">
          {sections.map((s) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleClick(s.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors",
                  "hover:bg-muted/60",
                  isActive && "bg-primary/10 text-primary font-medium",
                )}
              >
                {s.done ? (
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-success/15 text-success shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <Circle
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                )}
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
