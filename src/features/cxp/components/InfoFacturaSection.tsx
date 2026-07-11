/**
 * Sección de información adicional de una factura de proveedor:
 * categoría contable, datos fiscales, desglose, CFDI adjuntos y notas.
 * Sólo lectura.
 */
import { useState } from "react";
import { Info, FileCode2, FileText, Ban } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { useVerificarUuidSat } from "@/features/cxp/hooks/useVerificarUuidSat";
import { useCancelarFacturaProveedor } from "@/features/cxp/hooks/useCancelarFacturaProveedor";
import { ProgramacionPagoRow } from "@/features/cxp/components/ProgramacionPagoRow";
import { CancelarFacturaProveedorDialog } from "@/features/cxp/components/CancelarFacturaProveedorDialog";
import { Field, AdjuntoRow, CanceladaBanner, UuidFiscalField } from "./InfoFacturaSection.parts";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
}

export function InfoFacturaSection({ factura: f }: Props) {
  const showTc = f.moneda !== "MXN";
  const verificar = useVerificarUuidSat();
  const cancelar = useCancelarFacturaProveedor();
  const [openCancel, setOpenCancel] = useState(false);
  const estaCancelada = f.estado === "Cancelada";
  const verifDate = f.uuid_verificado_fecha
    ? new Date(f.uuid_verificado_fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : null;
  return (
    <section className="px-6 py-4 border-b bg-muted/10">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span>Información de la factura</span>
        </div>
        {!estaCancelada && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setOpenCancel(true)}
          >
            <Ban className="h-3.5 w-3.5 mr-1" />
            Cancelar factura
          </Button>
        )}
      </div>

      {estaCancelada && (
        <CanceladaBanner fecha={f.fecha_cancelacion} motivo={f.motivo_cancelacion} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        <Field label="Categoría contable" value={f.categoria_nombre} />
        <Field label="RFC proveedor" value={f.rfc_proveedor} mono />
        <UuidFiscalField
          uuid={f.uuid_fiscal}
          estatus={f.uuid_estatus_sat}
          verifDate={verifDate}
          isPending={verificar.isPending}
          onVerify={() => verificar.mutate(f.id)}
        />
        <Field label="Subtotal" value={<span className="tabular-nums">{formatCurrency(f.subtotal, f.moneda)}</span>} />
        <Field label="IVA" value={<span className="tabular-nums">{formatCurrency(f.iva, f.moneda)}</span>} />
        {(f.ieps ?? 0) > 0 && (
          <Field label="IEPS" value={<span className="tabular-nums">{formatCurrency(f.ieps ?? 0, f.moneda)}</span>} />
        )}
        <Field label="Retenciones" value={<span className="tabular-nums">{formatCurrency(f.retenciones, f.moneda)}</span>} />
        <Field
          label="Moneda"
          value={
            <span>
              {f.moneda}
              {showTc && f.tipo_cambio_usd > 0 && (
                <span className="text-muted-foreground text-xs ml-1.5">
                  · TC {f.tipo_cambio_usd.toFixed(4)}
                </span>
              )}
            </span>
          }
        />
        <Field
          label="Días de crédito"
          value={f.dias_credito != null ? `${f.dias_credito} días` : null}
        />
        <Field
          label="Embarque"
          value={f.embarque_id ? <span className="font-mono text-xs">{f.embarque_id.slice(0, 8)}…</span> : null}
        />
      </div>

      <div className="mt-4 pt-3 border-t">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">
          CFDI adjuntos
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <AdjuntoRow label="XML" icon={<FileCode2 className="h-4 w-4" />} path={f.archivo_xml_url} tipo="XML" />
          <AdjuntoRow label="PDF" icon={<FileText className="h-4 w-4" />} path={f.archivo_pdf_url} tipo="PDF" />
        </div>
      </div>
      <ProgramacionPagoRow
        facturaId={f.id}
        fechaProgramada={f.fecha_programada_pago}
        saldo={f.saldo}
      />

      {f.notas && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Notas
          </span>
          <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{f.notas}</p>
        </div>
      )}

      <CancelarFacturaProveedorDialog
        factura={f}
        open={openCancel}
        onOpenChange={setOpenCancel}
        isPending={cancelar.isPending}
        onConfirm={async (motivo) => {
          await cancelar.mutateAsync({ facturaId: f.id, motivo });
          setOpenCancel(false);
        }}
      />
    </section>
  );
}
