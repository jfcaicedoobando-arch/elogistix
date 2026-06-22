/**
 * Sección de información adicional de una factura de proveedor:
 * categoría contable, datos fiscales, desglose y notas.
 * Sólo lectura.
 */
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-sm text-foreground truncate ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

export function InfoFacturaSection({ factura: f }: Props) {
  const showTc = f.moneda !== "MXN";
  return (
    <section className="px-6 py-4 border-b bg-muted/10">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span>Información de la factura</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        <Field label="Categoría contable" value={f.categoria_nombre} />
        <Field label="RFC proveedor" value={f.rfc_proveedor} mono />
        <Field label="UUID fiscal (CFDI)" value={f.uuid_fiscal} mono />
        <Field label="Subtotal" value={<span className="tabular-nums">{formatCurrency(f.subtotal, f.moneda)}</span>} />
        <Field label="IVA" value={<span className="tabular-nums">{formatCurrency(f.iva, f.moneda)}</span>} />
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

      {f.notas && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Notas
          </span>
          <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{f.notas}</p>
        </div>
      )}
    </section>
  );
}
