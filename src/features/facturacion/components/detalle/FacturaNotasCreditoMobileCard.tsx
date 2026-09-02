/**
 * Tarjeta móvil de notas de crédito ligadas a una factura.
 * Extraída al migrar `FacturaNotasCreditoTable` a `ResponsiveDataTable`.
 */
import { Mail, XCircle, Stamp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { CfdiEstadoBadge, type CfdiEstadoTono } from "@/features/facturacion/components/CfdiEstadoBadge";
import type { NotaCreditoRow } from "./FacturaNotasCreditoTable";

const ESTADO_TONO: Record<NotaCreditoRow["estado"], CfdiEstadoTono> = {
  Borrador: "borrador",
  Aprobada: "aprobada",
  Timbrada: "timbrada",
  Aplicada: "aplicada",
  Cancelada: "cancelada",
};

function renderFolio(n: NotaCreditoRow): { texto: string; esBorrador: boolean } {
  const esBorrador = n.folio.startsWith("BORRADOR-");
  if (esBorrador) return { texto: "Borrador", esBorrador: true };
  if (n.folio_fiscal != null) return { texto: `${n.serie ?? ""}${n.folio_fiscal}`, esBorrador: false };
  return { texto: n.folio, esBorrador: false };
}

interface Props {
  row: NotaCreditoRow;
  canEdit: boolean;
  uuidFacturaOriginal: string | null;
  timbrando: boolean;
  onTimbrar: (id: string) => void;
  onEmail: (id: string) => void;
  onCancelar: (id: string) => void;
  onPreview: (n: NotaCreditoRow) => void;
}

export function FacturaNotasCreditoMobileCard({
  row: n, canEdit, uuidFacturaOriginal, timbrando, onTimbrar, onEmail, onCancelar, onPreview,
}: Props) {
  const folioRender = renderFolio(n);
  const timbrada = n.estado === "Timbrada" || n.estado === "Aplicada";
  const enVerificacion = ["pending", "verifying"].includes((n.cancellation_status ?? "").toLowerCase());
  const cancelable = n.estado === "Timbrada" && !enVerificacion;
  const puedeTimbrar = n.estado === "Borrador" && !!uuidFacturaOriginal;

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-body inline-flex items-center gap-1.5">
            {folioRender.esBorrador ? (
              <CfdiEstadoBadge tono="borrador">{folioRender.texto}</CfdiEstadoBadge>
            ) : (
              folioRender.texto
            )}
            <AmbienteBadge ambiente={n.ambiente} />
          </div>
          <div className="text-body-sm text-muted-foreground">{formatDate(n.fecha_emision)}</div>
          <div className="text-label text-muted-foreground truncate">{n.motivo}</div>
          <CfdiEstadoBadge tono={ESTADO_TONO[n.estado]}>{n.estado}</CfdiEstadoBadge>
        </div>
        <MoneyCell
          label="Monto"
          value={formatCurrency(Number(n.monto), n.moneda)}
          highlight
          className="shrink-0 max-w-[48%]"
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {timbrada && (
          <>
            <Hint label="Previsualizar PDF">
              <Button
                variant="outline" size="icon" className="min-h-11 min-w-11"
                aria-label="Previsualizar PDF"
                onClick={() => onPreview(n)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </Hint>
            <FacturaDownloadButton stored={n.pdf_url} kind="pdf" notaCreditoId={n.id} />
            <FacturaDownloadButton stored={n.xml_url} kind="xml" notaCreditoId={n.id} />
            <Hint label="Reenviar por email">
              <Button
                variant="outline" size="icon" className="min-h-11 min-w-11"
                aria-label="Reenviar por email"
                onClick={() => onEmail(n.id)}
              >
                <Mail className="h-3.5 w-3.5" />
              </Button>
            </Hint>
          </>
        )}
        {canEdit && puedeTimbrar && (
          <Button
            variant="outline" size="sm"
            onClick={() => onTimbrar(n.id)}
            disabled={timbrando}
          >
            <Stamp className="h-3.5 w-3.5 mr-1" /> Timbrar
          </Button>
        )}
        {canEdit && n.estado === "Timbrada" && (
          <Hint label={enVerificacion ? "El SAT está verificando la cancelación" : "Cancelar NC"}>
            <span>
              <Button
                variant="ghost" size="icon" className="min-h-11 min-w-11"
                aria-label="Cancelar NC"
                disabled={!cancelable}
                onClick={() => onCancelar(n.id)}
              >
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </span>
          </Hint>
        )}
      </div>
    </div>
  );
}
