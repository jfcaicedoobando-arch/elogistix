/**
 * ConsultaXmlCard — muestra los datos leídos del XML timbrado de la factura
 * (UUID, RFCs, total, moneda, fecha) y su estatus real en el SAT.
 */
import { FileWarning } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ConsultarFacturapiXml } from "@/features/facturacion/services/facturapi";
import { ConsultaSatBadge } from "./ConsultaSatBadge";

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-body">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-body-sm truncate max-w-[60%]" : "font-medium"}>{value}</span>
    </div>
  );
}

export function ConsultaXmlCard({ xml }: { xml: ConsultarFacturapiXml | null | undefined }) {
  if (!xml) return null;
  if (!xml.disponible) {
    return (
      <Alert variant="destructive">
        <FileWarning className="h-4 w-4" />
        <AlertDescription>
          No se pudo descargar el XML de la factura desde FacturApi.
          {xml.error ? ` Detalle: ${xml.error}` : ""}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-body-sm font-semibold text-muted-foreground uppercase">XML de la factura</div>
        <ConsultaSatBadge estatus={xml.estatus_sat} />
      </div>
      <Row label="UUID" value={xml.uuid ?? "—"} mono />
      <Row label="RFC emisor" value={xml.rfc_emisor ?? "—"} />
      <Row label="RFC receptor" value={xml.rfc_receptor ?? "—"} />
      <Row
        label="Total"
        value={xml.total == null ? "—" : formatCurrency(xml.total, xml.moneda ?? "MXN")}
      />
      <Row label="Fecha de timbrado" value={xml.fecha ?? "—"} />
      <Row label="Folio" value={xml.folio ? `${xml.serie ?? ""}${xml.folio}` : "—"} />
      {xml.sat_detalle && (
        <p className="text-body-sm text-muted-foreground pt-1 border-t">{xml.sat_detalle}</p>
      )}
    </div>
  );
}
