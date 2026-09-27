import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { SalidaPagoImpacto } from "@/features/cxp/services/pagoImpactoPreview";

export function SalidaPagoPreview({ salida }: { salida: SalidaPagoImpacto }) {
  const detalle = salida.tipo === "efectivo"
    ? "Sin movimiento bancario"
    : salida.cuentaEtiqueta ?? "Selecciona una cuenta bancaria";
  const equivalente = salida.tipo === "banco" && salida.montoMxn != null && salida.moneda !== "MXN"
    ? ` · ≈ ${formatCurrency(salida.montoMxn, "MXN")}` : "";
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-body-sm font-medium">{salida.tipo === "banco" ? "Salida de banco" : "Pago en efectivo"}</p>
          <p className="text-label text-muted-foreground break-words">{detalle}{equivalente}</p>
        </div>
      </div>
      <span className="shrink-0 text-body font-semibold tabular-nums">
        {formatCurrency(salida.monto, salida.moneda)}
      </span>
    </div>
  );
}
