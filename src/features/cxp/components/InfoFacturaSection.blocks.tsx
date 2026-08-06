/**
 * Bloques de sólo lectura extraídos de `InfoFacturaSection` para bajar la
 * complejidad ciclomática del componente principal por debajo de 16.
 * v13.307.17
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters/dates";
import { formatCurrency } from "@/lib/formatters";
import { Field, UuidFiscalField } from "./InfoFacturaSection.parts";
import type { FacturaCxP } from "@/features/cxp/services";

function EmbarqueValor({ f }: { f: FacturaCxP }) {
  if (!f.embarque_id) return null;
  if (f.embarque_expediente) {
    return (
      <Button variant="link" size="sm" asChild className="h-auto p-0 font-medium">
        <Link to={`/embarques/${f.embarque_id}`}>{f.embarque_expediente}</Link>
      </Button>
    );
  }
  return <span className="text-muted-foreground italic text-xs">Sin expediente</span>;
}

function VencimientoValor({ f }: { f: FacturaCxP }) {
  if (!f.fecha_vencimiento) return null;
  const overdue = f.dias_vencido > 0 && f.saldo > 0.01;
  return (
    <span className="inline-flex items-center gap-2">
      <span>{formatDate(f.fecha_vencimiento)}</span>
      {overdue && (
        <span className="px-1.5 py-0.5 rounded text-2xs font-semibold text-destructive bg-destructive/10 border border-destructive/30 uppercase tracking-wide">
          +{f.dias_vencido} d
        </span>
      )}
    </span>
  );
}

export function FechasCreditoBlock({ f }: { f: FacturaCxP }) {
  return (
    <div className="space-y-1">
      <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Fechas y crédito
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
        <Field
          label="Fecha de expedición"
          value={f.fecha_emision ? formatDate(f.fecha_emision) : null}
        />
        <Field label="Fecha de vencimiento" value={<VencimientoValor f={f} />} />
        <Field label="Días de crédito" value={f.dias_credito != null ? `${f.dias_credito} días` : null} />
      </div>
    </div>
  );
}

function MonedaValor({ f, showTc }: { f: FacturaCxP; showTc: boolean }) {
  return (
    <span>
      {f.moneda}
      {showTc && f.tipo_cambio_usd > 0 && (
        <span className="text-muted-foreground text-xs ml-1.5">
          · TC {f.tipo_cambio_usd.toFixed(4)}
        </span>
      )}
    </span>
  );
}

export function DesgloseFiscalBlock({ f }: { f: FacturaCxP }) {
  const showTc = f.moneda !== "MXN";
  const mono = (n: number) => (
    <span className="tabular-nums">{formatCurrency(n, f.moneda)}</span>
  );
  return (
    <div className="space-y-1">
      <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Desglose fiscal
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
        <Field label="Subtotal" value={mono(f.subtotal)} />
        <Field label="IVA" value={mono(f.iva)} />
        {(f.ieps ?? 0) > 0 && <Field label="IEPS" value={mono(f.ieps ?? 0)} />}
        <Field label="Retenciones" value={mono(f.retenciones)} />
        <Field
          label="Total"
          value={<span className="tabular-nums font-semibold text-foreground">{formatCurrency(f.total, f.moneda)}</span>}
        />
        <Field label="Moneda" value={<MonedaValor f={f} showTc={showTc} />} />
      </div>
    </div>
  );
}

export function ReferenciasFiscalesBlock({
  f, verifDate, isVerifying, onVerify,
}: {
  f: FacturaCxP;
  verifDate: string | null;
  isVerifying: boolean;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Referencias fiscales
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
        <Field label="Categoría contable" value={f.categoria_nombre} />
        <Field label="RFC proveedor" value={f.rfc_proveedor} mono />
        <UuidFiscalField
          uuid={f.uuid_fiscal}
          estatus={f.uuid_estatus_sat}
          verifDate={verifDate}
          isPending={isVerifying}
          onVerify={onVerify}
          esExtranjero={f.proveedor_origen === "Extranjero"}
        />
        <Field label="Embarque" value={<EmbarqueValor f={f} />} />
      </div>
    </div>
  );
}
