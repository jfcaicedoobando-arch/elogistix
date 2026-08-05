/**
 * Selector de origen del documento para la captura de facturas de proveedor.
 *
 * v13.422.0 — Antes eran pestañas dentro de la columna izquierda; ahora es una
 * banda de ancho completo con tres tarjetas, porque es la PRIMERA decisión del
 * flujo y debe leerse antes que cualquier campo.
 */
import { Keyboard, FileCode2, Sparkles, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CargaMode = "manual" | "cfdi" | "pdf_ia";

interface Opcion {
  value: CargaMode;
  icon: LucideIcon;
  titulo: string;
  ayuda: string;
  etiqueta?: string;
}

const OPCIONES: Opcion[] = [
  {
    value: "manual",
    icon: Keyboard,
    titulo: "Capturar a mano",
    ayuda: "Escribes los datos y las partidas.",
  },
  {
    value: "cfdi",
    icon: FileCode2,
    titulo: "Subir XML del CFDI",
    ayuda: "Se llena solo con los datos del SAT.",
    etiqueta: "México",
  },
  {
    value: "pdf_ia",
    icon: Sparkles,
    titulo: "Leer PDF con IA",
    ayuda: "Para proveedores que no mandan XML.",
    etiqueta: "Internacional",
  },
];

interface Props {
  mode: CargaMode;
  onModeChange: (m: CargaMode) => void;
}

export function OrigenDocumentoPicker({ mode, onModeChange }: Props) {
  return (
    <section className="space-y-2" aria-labelledby="origen-documento-titulo">
      <h3
        id="origen-documento-titulo"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        ¿Cómo vas a capturar esta factura?
      </h3>
      <div
        role="radiogroup"
        aria-labelledby="origen-documento-titulo"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {OPCIONES.map((o) => {
          const activo = mode === o.value;
          const Icono = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onModeChange(o.value)}
              className={cn(
                "group relative rounded-lg border p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activo
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "bg-card hover:border-muted-foreground/40 hover:bg-muted/40",
              )}
            >
              {activo && (
                <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" aria-hidden />
              )}
              title={o.ayuda}
            >
              {activo && (
                <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" aria-hidden />
              )}
              <div className="flex flex-wrap items-center gap-1.5 short:gap-2">
                <Icono
                  className={cn(
                    "h-4 w-4 shrink-0",
                    activo ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium leading-tight">{o.titulo}</span>
                {o.etiqueta && (
                  <Badge variant="secondary" className="text-2xs">{o.etiqueta}</Badge>
                )}
              </div>
              {/* En pantallas bajas la ayuda vive en el tooltip nativo. */}
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground short:hidden">
                {o.ayuda}
              </p>
            </button>

          );
        })}
      </div>
    </section>
  );
}
