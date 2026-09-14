/**
 * Celdas de presentación del historial de proformas (estado y total).
 *
 * Se extrajo de `HistorialProformas.tsx` para respetar el límite Power-of-10 de
 * 200 líneas por archivo. Sólo presentación: sin consultas ni estado.
 */
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { ProformaConFactura } from "@/features/proformas/services";
import { esBorradorVacio } from "./esBorradorVacio";
import { etiquetaProformaConvertida } from "@/lib/domain/etiquetaCicloProforma";
import { getEstadoUnificado } from "@/lib/domain/estadoUnificado";

export type FacturaEmbarqueLite = {
  id?: string;
  estado: string;
  proforma_id?: string | null;
};

export function renderEstado(
  p: ProformaConFactura,
  proformas: ProformaConFactura[],
  facturas: FacturaEmbarqueLite[],
) {
  const rev = p.estado_revision ?? "aprobada";
  const vacio = esBorradorVacio(p);
  const unificado = getEstadoUnificado(p);
  if (unificado === "facturada") {
    // B9 (v13.823.153): distingue borrador, "por timbrar" y emisión real.
    // C30 (v13.823.381): en una fusión de varias proformas la factura queda con
    // `proforma_id = NULL`; el vínculo vive en la proforma (`factura_id` /
    // `factura_secundaria_id`). Se acepta cualquiera de los dos caminos.
    const propias = facturas.filter(
      f => f.proforma_id === p.id
        || (!!f.id && (f.id === p.factura_id || f.id === p.factura_secundaria_id)),
    );
    const etiqueta = propias.length > 0 ? etiquetaProformaConvertida(propias) : "Convertida";
    const emitida = etiqueta === "Facturada";
    return <Badge variant={emitida ? "success" : "info"} className="w-fit">{etiqueta}</Badge>;
  }
  if (vacio) return (
    <Badge variant="outline" className="w-fit bg-warning/10 text-warning border-warning/30">
      Borrador vacío
    </Badge>
  );
  if (rev === "consolidada") {
    const num = proformas.find(x => x.id === p.consolidada_en)?.numero;
    return <Badge variant="info" className="w-fit">Consolidada{num ? ` en ${num}` : ""}</Badge>;
  }

  // 2. Respuesta del cliente tiene prioridad sobre revisión interna.
  if (unificado === "rechazada") return <Badge variant="destructive" className="w-fit">Rechazada</Badge>;
  if (unificado === "aceptada") return <Badge variant="success" className="w-fit">Aceptada</Badge>;

  // 3. Sin respuesta del cliente: reflejar el estado de revisión interna.
  if (rev === "pendiente") return <Badge variant="warning" className="w-fit">Pendiente cliente</Badge>;
  return <Badge variant="outline" className="w-fit">Enviada al cliente</Badge>;
}

export function totalUnico(p: ProformaConFactura) {
  const usd = Number(p.total_usd);
  const mxn = Number(p.total_mxn);
  if (usd > 0 && mxn === 0) return formatCurrency(usd, "USD");
  if (mxn > 0 && usd === 0) return formatCurrency(mxn, "MXN");
  if (usd > 0 && mxn > 0) {
    return (
      <div className="flex flex-col items-end leading-tight">
        <span>{formatCurrency(usd, "USD")}</span>
        <span className="text-body-sm text-muted-foreground">{formatCurrency(mxn, "MXN")}</span>
      </div>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}
