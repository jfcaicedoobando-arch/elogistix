/**
 * ReferenciasEmbarquePreview — v13.208.0
 *
 * Muestra cómo aparecerán el Expediente + BL Master + BL House en la
 * factura antes de timbrar. Analogía: la etiqueta borrador que el
 * mensajero pega en la caja para que confirmes antes de sellarla.
 */
import { FileBadge2 } from "lucide-react";
import {
  useReferenciasEmbarqueFactura,
  formatearPrefijoReferencias,
  hasAlgunaReferencia,
} from "@/features/facturacion/hooks/useReferenciasEmbarqueFactura";

interface Props {
  factura: {
    embarque_id?: string | null;
    expediente?: string | null;
    referencia_bl?: string | null;
  } | null | undefined;
  /** Descripción del primer concepto para armar la vista previa exacta. */
  primeraDescripcion?: string | null;
}

export function ReferenciasEmbarquePreview({ factura, primeraDescripcion }: Props) {
  const { data: ref, isLoading } = useReferenciasEmbarqueFactura(factura);
  if (isLoading) return null;
  if (!hasAlgunaReferencia(ref)) return null;

  const prefijo = formatearPrefijoReferencias(ref);
  const ejemplo = primeraDescripcion
    ? `${prefijo}${primeraDescripcion}`
    : prefijo.trim();

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs space-y-2">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <FileBadge2 className="h-3.5 w-3.5" />
        Referencias que se incluirán en la factura
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-3">
        {ref?.expediente ? (
          <li>
            <span className="text-muted-foreground">Expediente: </span>
            <span className="font-mono">{ref.expediente}</span>
          </li>
        ) : null}
        {ref?.bl_master ? (
          <li>
            <span className="text-muted-foreground">BL Master: </span>
            <span className="font-mono">{ref.bl_master}</span>
          </li>
        ) : null}
        {ref?.bl_house ? (
          <li>
            <span className="text-muted-foreground">BL House: </span>
            <span className="font-mono">{ref.bl_house}</span>
          </li>
        ) : null}
      </ul>
      <div className="text-muted-foreground">
        Se agregarán como prefijo en cada concepto del CFDI y como bloque
        <span className="font-medium text-foreground"> "Referencias del embarque"</span> al pie del PDF.
      </div>
      {ejemplo ? (
        <div className="rounded bg-background/60 p-2 font-mono text-label leading-tight break-words">
          {ejemplo}
        </div>
      ) : null}
    </div>
  );
}
