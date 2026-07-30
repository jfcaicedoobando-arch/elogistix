/**
 * Sub-componentes presentacionales de `ProformaDetalle`.
 * Extraídos para mantener la página ≤200 líneas (Power-of-10 #4) y reducir
 * la complejidad ciclomática del componente página.
 */
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import type { ProformaDetalleFull } from "@/features/proformas/services";

export { AccionesProforma } from "./AccionesProforma";
export { EstadoBadges } from "./ProformaEstadoBadges";

type FacturaAsociada = ProformaDetalleFull["facturas_asociadas"][number];


export function NotasCard({ notas }: { notas: string | null | undefined }) {
  const texto = (notas ?? "").trim();
  if (!texto) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Notas</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-line break-words">{texto}</p>
      </CardContent>
    </Card>
  );
}



function FacturaAsociadaItem({ factura, showHeader }: { factura: FacturaAsociada; showHeader: boolean }) {
  const timbrada = !!factura.uuid_fiscal;
  const tieneArchivos = !!(factura.factura_pdf_url || factura.factura_xml_url || timbrada);
  const numero = factura.numero || "(borrador sin folio)";
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
          {showHeader && <span>Factura asociada</span>}
          <span className="font-mono">{numero}</span>
          <StatusBadge domain="factura" status={factura.estado} />
          <span className="text-xs text-muted-foreground font-normal">{factura.moneda}</span>
        </CardTitle>
        <Button size="sm" asChild>
          <Link to={`/facturacion/${factura.id}`}>
            <ExternalLink className="h-4 w-4 mr-1.5" /> Ver factura
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Monto</p>
          <p className="tabular-nums font-medium">{formatCurrency(Number(factura.total), factura.moneda)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha emisión</p>
          <p>{factura.fecha_emision ? formatDate(factura.fecha_emision) : '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">UUID fiscal</p>
          <p className="font-mono text-xs truncate" title={factura.uuid_fiscal ?? ''}>
            {factura.uuid_fiscal || '—'}
          </p>
        </div>
        {tieneArchivos && (
          <div className="col-span-2 md:col-span-3 flex flex-wrap gap-2 pt-1 border-t">
            <FacturaDownloadButton stored={factura.factura_pdf_url ?? null} kind="pdf" size="sm" facturaId={factura.id} />
            <FacturaDownloadButton stored={factura.factura_xml_url ?? null} kind="xml" size="sm" facturaId={factura.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FacturaAsociadaCard({ facturas }: { facturas: FacturaAsociada[] }) {
  if (!facturas.length) return null;
  if (facturas.length === 1) {
    return <FacturaAsociadaItem factura={facturas[0]} showHeader />;
  }
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Facturas asociadas ({facturas.length})</h2>
      <p className="text-xs text-muted-foreground -mt-2">
        Esta proforma se dividió en varios CFDI (el SAT no permite CFDI multi-moneda).
      </p>
      {facturas.map((f) => (
        <FacturaAsociadaItem key={f.id} factura={f} showHeader={false} />
      ))}
    </div>
  );
}


// Los totales viven ahora al pie de la tabla de conceptos
// (`ProformaConceptosCard`), evitando duplicar el total del header.

