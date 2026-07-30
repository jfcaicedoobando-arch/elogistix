/**
 * Encabezado de la página de factura de proveedor: folio interno, proveedor,
 * expediente enlazado, stepper de ciclo de vida y acciones contextuales.
 */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { DocumentoStatusStepper } from "@/components/shared/documento/DocumentoStatusStepper";
import { resumenFacturaRecibida } from "@/lib/domain/documentoEstados";
import { EstadoFacturaCxPCell } from "@/features/cxp/components/EstadoFacturaCxPCell";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
  actions?: ReactNode;
}

export function FacturaProveedorHeader({ factura: f, actions }: Props) {
  const resumen = resumenFacturaRecibida({
    estado: f.estado,
    estadoAprobacion: f.estado_aprobacion,
  });

  return (
    <DetailHeader
      backTo="/compras/facturas"
      backLabel="Volver a Facturas de proveedor"
      icon={<ReceiptText className="h-6 w-6 shrink-0 text-accent" />}
      title={<span className="font-mono tabular-nums">{f.folio_interno}</span>}
      badge={<EstadoFacturaCxPCell factura={f} />}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          <span>{f.proveedor_nombre}</span>
          <span aria-hidden>•</span>
          <span>
            Folio prov.: <span className="font-mono">{f.folio_proveedor}</span>
          </span>
          {f.fecha_emision && (
            <>
              <span aria-hidden>•</span>
              <span>Expedida {formatDate(f.fecha_emision)}</span>
            </>
          )}
          {f.embarque_id && f.embarque_expediente && (
            <>
              <span aria-hidden>•</span>
              <span>
                Exp.:{" "}
                <Link
                  to={`/embarques/${f.embarque_id}`}
                  className="font-mono text-accent hover:underline"
                >
                  {f.embarque_expediente}
                </Link>
              </span>
            </>
          )}
        </span>
      }
      meta={<DocumentoStatusStepper resumen={resumen} />}
      trailing={
        <div className="flex w-full flex-col items-start gap-3 lg:w-auto lg:items-end">
          <div className="shrink-0 text-left lg:text-right">
            <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(f.total, f.moneda)}
            </p>
            {f.estado !== "Cancelada" && f.saldo > 0.005 && (
              <p className="mt-0.5 text-xs tabular-nums text-destructive">
                Pendiente: {formatCurrency(f.saldo, f.moneda)}
              </p>
            )}
          </div>
          {actions ? <div className="w-full lg:w-auto">{actions}</div> : null}
        </div>
      }
    />
  );
}
