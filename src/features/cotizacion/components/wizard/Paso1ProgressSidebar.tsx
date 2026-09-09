import { useEffect, useRef, useState, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Check, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { usePaso1SectionStatus } from "@/features/cotizacion/hooks/usePaso1SectionStatus";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

/** Alto aproximado del header fijo del wizard + holgura de lectura. */
const HEADER_OFFSET_PX = 88;

/** Contenedor scrollable real más cercano (el cuerpo del wizard). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let actual: HTMLElement | null = el.parentElement;
  while (actual) {
    const overflowY = window.getComputedStyle(actual).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && actual.scrollHeight > actual.clientHeight) {
      return actual;
    }
    actual = actual.parentElement;
  }
  return null;
}

/**
 * VIS-CE-251-03 · R257 — altura útil medida, no un valor mágico: el panel va
 * desde su propio borde superior hasta el pie de acciones del wizard (o el
 * borde inferior de la ventana si ese pie no está montado).
 */
function useAlturaUtil(ref: React.RefObject<HTMLElement | null>): number | null {
  const [alto, setAlto] = useState<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const footer = document.querySelector<HTMLElement>("[data-wizard-footer]");
      const limiteInferior = footer
        ? footer.getBoundingClientRect().top
        : window.innerHeight;
      const disponible = Math.round(limiteInferior - top - 8);
      setAlto(disponible > 160 ? disponible : 160);
    };
    const programar = () => {
      if (raf === 0) raf = window.requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", programar, true);
    window.addEventListener("resize", programar);
    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", programar, true);
      window.removeEventListener("resize", programar);
    };
  }, [ref]);
  return alto;
}

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
  const asideRef = useRef<HTMLElement>(null);
  const alturaUtil = useAlturaUtil(asideRef);
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

  // VIS-20260908-01: antes se usaba un IntersectionObserver con
  // `rootMargin: -20% 0px -60%`. Al hacer clic en una sección ésta queda
  // alineada justo debajo del header fijo del wizard (fuera de esa banda), así
  // que la sección ANTERIOR seguía marcada como activa. Ahora la sección
  // activa se calcula con la posición real: es la última cuyo borde superior
  // ya pasó el header fijo, consultando el contenedor scrollable real.
  useEffect(() => {
    let raf = 0;
    const calcular = () => {
      raf = 0;
      const elementos = sections
        .map((s) => ({ id: s.id, el: document.getElementById(s.id) }))
        .filter((x): x is { id: string; el: HTMLElement } => x.el !== null);
      if (elementos.length === 0) return;
      const scroller = scrollParent(elementos[0].el);
      // Al final del scroll gana la última sección: ya no puede subir más allá
      // del header, y si no se marcara quedaría activa una intermedia.
      if (scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) {
        setActiveId(elementos[elementos.length - 1].id);
        return;
      }
      const limite = (scroller?.getBoundingClientRect().top ?? 0) + HEADER_OFFSET_PX;
      let actual = elementos[0].id;
      for (const { id, el } of elementos) {
        if (el.getBoundingClientRect().top <= limite) actual = id;
        else break;
      }
      setActiveId(actual);
    };
    const programar = () => {
      if (raf === 0) raf = window.requestAnimationFrame(calcular);
    };
    calcular();
    // `capture: true` para escuchar también el scroll de contenedores internos
    // (el cuerpo del wizard es el que hace scroll, no el documento).
    window.addEventListener("scroll", programar, true);
    window.addEventListener("resize", programar);
    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", programar, true);
      window.removeEventListener("resize", programar);
    };
  }, [sections]);

  const completas = sections.filter((s) => s.done).length;
  const total = sections.length;
  const pct = Math.round((completas / total) * 100);
  // Aclara qué se cuenta en "X de Y": el denominador cambia según el modo
  // (marítimo agrega Tarifa/Flete), así que el texto lo explicita.
  const modoLabel = esMaritimo ? (esLcl ? " (marítimo LCL)" : " (marítimo)") : " (terrestre/aéreo)";
  // VF-09/VF-19: el checklist dice qué falta y por qué cambia el denominador.
  const faltantes = sections.filter((s) => !s.done).map((s) => s.label);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Feedback inmediato: el cálculo por scroll lo confirma al terminar la
    // animación, pero el botón pulsado no debe esperar para marcarse.
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    // VIS-CE-251-03: la tarjeta se limita a la altura útil de la ventana con
    // scroll propio, para que la sección «Cierre» sea alcanzable sin
    // desplazar la página completa ni superponer la barra de acciones.
    <aside
      ref={asideRef}
      className="hidden lg:block sticky top-4 self-start w-56 shrink-0"
      style={alturaUtil ? { maxHeight: `${alturaUtil}px` } : undefined}
    >
      <div
        className="rounded-lg border bg-card p-4 space-y-3 overflow-y-auto"
        style={alturaUtil ? { maxHeight: `${alturaUtil}px` } : undefined}
      >
        <div className="space-y-1">
          <SectionHeading as="h2">Progreso del Paso 1</SectionHeading>
          <p className="text-body-sm text-muted-foreground">
            {completas} de {total} secciones completas{modoLabel}
          </p>
          <Progress value={pct} className="h-1.5" />
          {faltantes.length > 0 && (
            <p className="text-body-sm text-muted-foreground">
              Falta: {faltantes.join(", ")}
            </p>
          )}
          <p className="text-label text-muted-foreground">
            El total de secciones varía según el modo de transporte.
          </p>
        </div>
        <nav className="space-y-1" aria-label="Secciones del Paso 1">
          {sections.map((s) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleClick(s.id)}
                // Estado accesible de "sección actual" (antes sólo era color).
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-body transition-colors",
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
