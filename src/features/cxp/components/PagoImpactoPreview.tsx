/**
 * Vista previa del impacto del pago (v13.393.0):
 * antes de guardar, muestra cómo queda la factura, el saldo del proveedor
 * y cuánto sale del banco.
 */
import { ArrowRight, Wallet, FileText, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { ImpactoPago } from "@/features/cxp/services/pagoImpactoPreview";

interface FilaProps {
  icon: React.ReactNode;
  label: string;
  antes: string;
  despues: string;
  detalle?: string;
  tone?: "default" | "success" | "warn";
}

function FilaImpacto({ icon, label, antes, despues, detalle, tone = "default" }: FilaProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{label}</p>
          {detalle && <p className="text-label text-muted-foreground truncate">{detalle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 tabular-nums">
        <span className="text-xs text-muted-foreground line-through">{antes}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
        <span
          className={cn(
            "text-sm font-semibold",
            tone === "success" && "text-success",
            tone === "warn" && "text-warning",
          )}
        >
          {despues}
        </span>
      </div>
    </div>
  );
}

interface Props {
  impacto: ImpactoPago | null;
  proveedorNombre: string;
  cargandoProveedor?: boolean;
}

export function PagoImpactoPreview({ impacto, proveedorNombre, cargandoProveedor }: Props) {
  if (!impacto) return null;

  const { factura, proveedor, banco } = impacto;
  const moneda = factura.moneda;

  return (
    <div className="rounded-lg border bg-accent/5 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vista previa del impacto
        </p>
        <span
          className={cn(
            "text-label font-semibold uppercase tracking-wide",
            factura.liquidaFactura ? "text-success" : "text-muted-foreground",
          )}
        >
          {impacto.aplicable ? factura.estadoDespues : "Captura el monto"}
        </span>
      </div>

      <div className="divide-y">
        <FilaImpacto
          icon={<FileText className="h-4 w-4" />}
          label="Saldo de esta factura"
          detalle={`Pagado ${formatCurrency(factura.pagadoAntes, moneda)} → ${formatCurrency(factura.pagadoDespues, moneda)} de ${formatCurrency(factura.total, moneda)}`}
          antes={formatCurrency(factura.saldoAntes, moneda)}
          despues={formatCurrency(factura.saldoDespues, moneda)}
          tone={factura.excede ? "warn" : factura.liquidaFactura ? "success" : "default"}
        />

        <FilaImpacto
          icon={<Building2 className="h-4 w-4" />}
          label={`Saldo total con ${proveedorNombre}`}
          detalle={
            cargandoProveedor
              ? "Calculando facturas abiertas…"
              : proveedor
                ? `${proveedor.facturasAbiertasAntes} → ${proveedor.facturasAbiertasDespues} facturas abiertas en ${moneda}`
                : "Saldo del proveedor no disponible"
          }
          antes={proveedor ? formatCurrency(proveedor.saldoAntes, moneda) : "—"}
          despues={proveedor ? formatCurrency(proveedor.saldoDespues, moneda) : "—"}
          tone={proveedor && proveedor.saldoDespues <= 0.01 ? "success" : "default"}
        />

        <div className="flex items-start justify-between gap-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium">Salida de banco</p>
              <p className="text-label text-muted-foreground truncate">
                {banco.cuentaEtiqueta ?? "Sin cuenta seleccionada"}
                {banco.montoMxn != null && banco.moneda !== "MXN"
                  ? ` · ≈ ${formatCurrency(banco.montoMxn, "MXN")}`
                  : ""}
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0">
            {formatCurrency(banco.monto, banco.moneda)}
          </span>
        </div>
      </div>

      {factura.excede && (
        <p className="text-xs text-destructive mt-1">
          El pago excede el saldo de la factura; ajusta el monto antes de guardar.
        </p>
      )}
    </div>
  );
}
