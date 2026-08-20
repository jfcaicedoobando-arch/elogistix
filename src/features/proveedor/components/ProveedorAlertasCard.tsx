/**
 * Alertas proactivas del proveedor (Ola 4): vencidas, datos bancarios,
 * embarques cerrados sin factura y vigencia de documentos.
 */
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  construirAlertas,
  type AlertasProveedor,
  type SeveridadAlerta,
} from "@/features/proveedor/domain/inteligenciaProveedor";

const TONO: Record<SeveridadAlerta, string> = {
  critica: "border-destructive/30 bg-destructive/5 text-destructive",
  media: "border-warning/30 bg-warning/5 text-warning",
  info: "border-border bg-muted/40 text-muted-foreground",
};

export function ProveedorAlertasCard({ alertas }: { alertas: AlertasProveedor }) {
  const items = construirAlertas(alertas);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-body text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Sin alertas: el proveedor está al día en facturación, pagos y documentos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="space-y-2"
      role="status"
      aria-label={`${items.length} ${items.length === 1 ? "alerta" : "alertas"} del proveedor`}
    >
      {items.map((a) => {
        const Icono = a.severidad === "info" ? Info : AlertTriangle;
        return (
          <div
            key={a.id}
            className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", TONO[a.severidad])}
          >
            <Icono className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium">{a.titulo}</p>
              <p className="text-body-sm opacity-80">{a.detalle}</p>
            </div>
            {a.montoMxn != null && a.montoMxn > 0 && (
              <span className="text-body font-medium tabular-nums shrink-0">
                {formatCurrency(a.montoMxn, "MXN")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
