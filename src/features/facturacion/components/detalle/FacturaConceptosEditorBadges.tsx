/**
 * Insignias de tratamiento de IVA y retenciones de los renglones del editor de
 * conceptos. Extraído de `FacturaConceptosEditorRows.tsx` para respetar el
 * límite Power-of-10 de 200 líneas por archivo.
 */
import { Badge } from "@/components/ui/badge";
import { LABEL_TRATAMIENTO_PENDIENTE } from "./facturaTratamientoPendiente";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

const TIPO_IVA_SHORT: Record<TipoIvaConcepto, string> = {
  gravado_16: "16%",
  gravado_8: "8%",
  tasa_0: "0%",
  exento: "Exento",
  no_objeto: "No objeto",
};

export function IvaBadge({ tipo }: { tipo: TipoIvaConcepto | null | undefined }) {
  if (!tipo) return <Badge variant="outline">{LABEL_TRATAMIENTO_PENDIENTE}</Badge>;
  const variant: "default" | "secondary" | "outline" =
    tipo === "gravado_16" || tipo === "gravado_8" ? "default" : tipo === "tasa_0" ? "secondary" : "outline";
  return <Badge variant={variant}>{TIPO_IVA_SHORT[tipo]}</Badge>;
}

export function RetBadges({ isr, iva }: { isr: number; iva: number }) {
  if (!isr && !iva) return <span className="text-body-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {isr > 0 && <Badge variant="outline" className="text-2xs">ISR {(isr * 100).toFixed(isr === 0.1 ? 0 : 2)}%</Badge>}
      {iva > 0 && <Badge variant="outline" className="text-2xs">IVA {(iva * 100).toFixed(iva === 0.04 ? 0 : 2)}%</Badge>}
    </div>
  );
}
