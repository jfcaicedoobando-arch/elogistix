import { formatCurrency, formatDate } from "@/lib/formatters";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { PortalRepDownloadButtons } from "./PortalRepDownloadButtons";

/**
 * Lista de pagos aplicados a una factura en el portal del cliente.
 * Extraída de `PortalFacturaPagosCard` para respetar el límite de complejidad
 * (Power of 10); el contenido visible es idéntico.
 */
export interface PortalPagoFila {
  id: string;
  fecha_pago: string;
  forma_pago: string | null;
  referencia?: string | null;
  monto: number | string;
  monto_aplicado_factura: number | string;
  moneda: string;
  rep_pdf_url?: string | null;
  rep_xml_url?: string | null;
}

interface Props {
  pagos: readonly PortalPagoFila[];
  /** Moneda de la factura: rige el importe aplicado. */
  moneda: string;
}

export function PortalFacturaPagosLista({ pagos, moneda }: Props) {
  return (
    <ul className="divide-y">
      {pagos.map((p) => (
        <li key={p.id} className="py-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium">{formatDate(p.fecha_pago)}</p>
            <p className="text-body-sm text-muted-foreground truncate">
              {labelDeCatalogo(FORMAS_PAGO_SAT, p.forma_pago)}
              {p.referencia ? ` • ${p.referencia}` : ""}
            </p>
            <PortalRepDownloadButtons
              pagoId={p.id}
              tienePdf={!!p.rep_pdf_url}
              tieneXml={!!p.rep_xml_url}
            />
          </div>
          <div className="text-right shrink-0">
            <p className="text-body font-bold tabular-nums">
              {formatCurrency(Number(p.monto_aplicado_factura), moneda)}
            </p>
            {p.moneda !== moneda && (
              <p className="text-label text-muted-foreground">
                {formatCurrency(Number(p.monto), p.moneda)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
