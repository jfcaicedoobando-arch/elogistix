/**
 * Tabla de notas de crédito ligadas a una factura. Extraída de
 * FacturaNotasCreditoSeccion para mantener el archivo ≤ 200 líneas.
 * Migrada a `DataTable` (Ola F, punto 8) con `TABLE_DENSITY.embebida`.
 * Migrada a `ResponsiveDataTable` para eliminar scroll horizontal en móvil.
 */
import { useState } from "react";
import { Mail, XCircle, Stamp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { AmbienteBadge } from "@/features/facturacion/components/AmbienteBadge";
import { DialogPreviewCfdiPdf } from "@/features/facturacion/components/DialogPreviewCfdiPdf";
import { CfdiEstadoBadge, type CfdiEstadoTono } from "@/features/facturacion/components/CfdiEstadoBadge";
import type { EstadoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { FacturaNotasCreditoMobileCard } from "./FacturaNotasCreditoMobileCard";

const ESTADO_TONO: Record<EstadoNotaCredito, CfdiEstadoTono> = {
  Borrador: "borrador",
  Aprobada: "aprobada",
  Timbrada: "timbrada",
  Aplicada: "aplicada",
  Cancelada: "cancelada",
};

export interface NotaCreditoRow {
  id: string;
  folio: string;
  /** Serie fiscal devuelta por FacturAPI (source of truth post-timbre). */
  serie?: string | null;
  /** Folio fiscal numérico devuelto por FacturAPI (source of truth post-timbre). */
  folio_fiscal?: number | null;
  fecha_emision: string;
  motivo: string;
  estado: EstadoNotaCredito;
  monto: number | string;
  moneda: string;
  pdf_url: string | null;
  xml_url: string | null;
  ambiente: "sandbox" | "live" | null;
  /** v13.821.6 (P1-2): bloquea una segunda cancelación mientras el SAT verifica. */
  cancellation_status?: string | null;
}

/**
 * v13.213.20 — FacturAPI = source of truth para el folio.
 * Los borradores llevan un folio provisional `BORRADOR-<ts>`; al timbrar
 * la edge sobreescribe `folio` con `<serie><folio_fiscal>`.
 */
function renderFolio(n: NotaCreditoRow): { texto: string; esBorrador: boolean } {
  const esBorrador = n.folio.startsWith("BORRADOR-");
  if (esBorrador) return { texto: "Borrador", esBorrador: true };
  if (n.folio_fiscal != null) return { texto: `${n.serie ?? ""}${n.folio_fiscal}`, esBorrador: false };
  return { texto: n.folio, esBorrador: false };
}

interface Props {
  notas: NotaCreditoRow[];
  canEdit: boolean;
  uuidFacturaOriginal: string | null;
  timbrando: boolean;
  onTimbrar: (id: string) => void;
  onEmail: (id: string) => void;
  onCancelar: (id: string) => void;
}

export function FacturaNotasCreditoTable(props: Props) {
  const { notas, canEdit, uuidFacturaOriginal, timbrando, onTimbrar, onEmail, onCancelar } = props;
  const [previewNc, setPreviewNc] = useState<NotaCreditoRow | null>(null);

  const columns: ColumnDef<NotaCreditoRow, unknown>[] = defineColumns<NotaCreditoRow>([
    {
      id: "folio", header: "Folio", meta: { width: COL_W.folio, className: "font-mono text-body-sm" },
      cell: ({ row }) => {
        const n = row.original;
        const folioRender = renderFolio(n);
        return (
          <span className="inline-flex items-center gap-1.5">
            {folioRender.esBorrador ? (
              <CfdiEstadoBadge tono="borrador">{folioRender.texto}</CfdiEstadoBadge>
            ) : (
              folioRender.texto
            )}
            <AmbienteBadge ambiente={n.ambiente} />
          </span>
        );
      },
    },
    { id: "fecha", header: "Fecha", meta: { width: COL_W.fecha }, cell: ({ row }) => formatDate(row.original.fecha_emision) },
    { id: "motivo", header: "Motivo", meta: { width: COL_W.texto }, cell: ({ row }) => row.original.motivo },
    {
      id: "estado", header: "Estado", meta: { width: COL_W.estado },
      cell: ({ row }) => <CfdiEstadoBadge tono={ESTADO_TONO[row.original.estado]}>{row.original.estado}</CfdiEstadoBadge>,
    },
    {
      id: "monto", header: "Monto", meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => formatCurrency(Number(row.original.monto), row.original.moneda),
    },
    {
      id: "acciones", header: "Acciones", meta: { width: "w-44", align: "right" },
      cell: ({ row }) => {
        const n = row.original;
        const timbrada = n.estado === "Timbrada" || n.estado === "Aplicada";
        const enVerificacion = ["pending", "verifying"].includes((n.cancellation_status ?? "").toLowerCase());
        const cancelable = n.estado === "Timbrada" && !enVerificacion;
        const puedeTimbrar = n.estado === "Borrador" && !!uuidFacturaOriginal;
        return (
          <div className="flex justify-end items-center gap-1">
            {timbrada && (
              <>
                <Hint label="Previsualizar PDF">
                  <Button
                    variant="outline" size="icon" className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0"
                    aria-label="Previsualizar PDF"
                    onClick={() => setPreviewNc(n)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </Hint>
                <FacturaDownloadButton stored={n.pdf_url} kind="pdf" notaCreditoId={n.id} />
                <FacturaDownloadButton stored={n.xml_url} kind="xml" notaCreditoId={n.id} />
                <Hint label="Reenviar por email">
                  <Button
                    variant="outline" size="icon" className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0"
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
                variant="outline" size="sm" className="h-7"
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
                    variant="ghost" size="icon" className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0"
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
        );
      },
    },
  ]);

  return (
    <>
      <ResponsiveDataTable
        columns={columns}
        data={notas}
        rowKey={(n) => n.id}
        density={TABLE_DENSITY.embebida}
        emptyMessage="Sin notas de crédito."
        mobileCard={(row) => (
          <FacturaNotasCreditoMobileCard
            row={row}
            canEdit={canEdit}
            uuidFacturaOriginal={uuidFacturaOriginal}
            timbrando={timbrando}
            onTimbrar={onTimbrar}
            onEmail={onEmail}
            onCancelar={onCancelar}
            onPreview={setPreviewNc}
          />
        )}
      />
      <DialogPreviewCfdiPdf
        open={!!previewNc}
        onOpenChange={(o) => !o && setPreviewNc(null)}
        notaCreditoId={previewNc?.id}
        title={previewNc ? `Nota de crédito ${previewNc.serie ?? ""}${previewNc.folio_fiscal ?? previewNc.folio}` : "Nota de crédito"}
      />
    </>
  );
}
