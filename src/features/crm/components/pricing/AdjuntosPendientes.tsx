/**
 * Archivos elegidos en una solicitud nueva: aún no tiene folio, así que se
 * guardan en memoria y se suben justo después de guardar.
 */
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/ui/appFeedback";
import { MAX_ADJUNTO_BYTES } from "@/features/crm/services/pricing/adjuntosPricing";
import { SelectorAdjuntos } from "./SelectorAdjuntos";

interface Props { archivos: File[]; onChange: (files: File[]) => void; disabled?: boolean }

export function AdjuntosPendientes({ archivos, onChange, disabled }: Props) {
  const agregar = (nuevos: File[]) => {
    const grandes = nuevos.filter((f) => f.size > MAX_ADJUNTO_BYTES);
    if (grandes.length) {
      notifyError(undefined, { title: "Archivo demasiado grande", description: `${grandes.map((f) => f.name).join(", ")} pesa más de 10 MB.`, method: "CRM_PRICING_ADJUNTO" });
    }
    const validos = nuevos.filter((f) => f.size <= MAX_ADJUNTO_BYTES);
    if (validos.length) onChange([...archivos, ...validos]);
  };

  return (
    <div className="space-y-2">
      <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Archivos adjuntos</p>
      <SelectorAdjuntos onArchivos={agregar} disabled={disabled} />
      {archivos.length > 0 && (
        <ul className="space-y-1 text-body">
          {archivos.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border border-border px-2 py-1">
              <span className="truncate">{f.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={disabled}
                aria-label={`Quitar ${f.name}`} onClick={() => onChange(archivos.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
