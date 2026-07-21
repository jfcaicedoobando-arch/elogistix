/**
 * Sección de información de la factura de proveedor (sólo lectura).
 * v13.303.94 — Rediseño: grid 3 cols de datos, adjuntos + programación
 * en dos columnas, notas y banner de cancelada. Acciones destructivas se
 * exponen desde el StatusActionBar del modal padre.
 */
import { FileCode2, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useVerificarUuidSat } from "@/features/cxp/hooks/useVerificarUuidSat";
import { ProgramacionPagoRow } from "@/features/cxp/components/ProgramacionPagoRow";
import { Field, AdjuntoRow, CanceladaBanner, UuidFiscalField } from "./InfoFacturaSection.parts";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
}

export function InfoFacturaSection({ factura: f }: Props) {
  const showTc = f.moneda !== "MXN";
  const verificar = useVerificarUuidSat();
  const estaCancelada = f.estado === "Cancelada";
  const verifDate = f.uuid_verificado_fecha
    ? new Date(f.uuid_verificado_fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-primary">
          Información de la factura
        </h3>
      </div>

      {estaCancelada && (
        <CanceladaBanner fecha={f.fecha_cancelacion} motivo={f.motivo_cancelacion} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
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
        <Field label="Días de crédito" value={f.dias_credito != null ? `${f.dias_credito} días` : null} />
        <Field
          label="Embarque"
          value={f.embarque_id ? <span className="font-mono text-xs">{f.embarque_id.slice(0, 8)}…</span> : null}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">CFDI adjuntos</h4>
          <div className="flex flex-col gap-2">
            <AdjuntoRow label="XML" icon={<FileCode2 className="h-4 w-4" />} path={f.archivo_xml_url} tipo="XML" />
            <AdjuntoRow label="PDF" icon={<FileText className="h-4 w-4" />} path={f.archivo_pdf_url} tipo="PDF" />
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Programación de pago</h4>
          <ProgramacionPagoRow
            facturaId={f.id}
            fechaProgramada={f.fecha_programada_pago}
            saldo={f.saldo}
          />
        </div>
      </div>

      {f.notas && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Notas</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
            {f.notas}
          </p>
        </div>
      )}
    </section>
  );
}
