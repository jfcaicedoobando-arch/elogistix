/**
 * Barra de tope de vinculación: cuánto del subtotal de la factura ya se
 * asignó a conceptos de costo de embarque y cuánto queda disponible.
 *
 * En rojo (y con el guardado bloqueado) cuando lo asignado excede el subtotal.
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ResultadoTopeVinculacion } from "@/features/cxp/utils/topeVinculacion";

interface Props {
  resultado: ResultadoTopeVinculacion;
  subtotal: number;
  moneda: string;
}

export function TopeVinculacionBar({ resultado, subtotal, moneda }: Props) {
  if (resultado.lineas === 0) return null;
  const excede = resultado.excede;

  return (
    <div
      className={
        excede
          ? "rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs"
          : "rounded-md border border-success/40 bg-success/5 px-3 py-2 text-xs"
      }
    >
      <div
        className={`flex flex-wrap items-center gap-2 font-medium ${
          excede ? "text-destructive" : "text-success"
        }`}
      >
        {excede ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        )}
        <span>
          {excede
            ? `Asignaste ${formatCurrency(resultado.excedente, moneda)} más de lo que vale la factura`
            : "Lo asignado cabe en el importe de la factura"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3 tabular-nums text-foreground">
          <span className="text-muted-foreground">
            Subtotal:{" "}
            <span className="font-semibold text-foreground">{formatCurrency(subtotal, moneda)}</span>
          </span>
          <span className="text-muted-foreground">
            Asignado:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(resultado.asignado, moneda)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Disponible:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(resultado.disponible, moneda)}
            </span>
          </span>
        </div>
      </div>
      {excede && (
        <p className="text-muted-foreground mt-1 pl-6">
          Baja el monto de algún concepto o desmarca los que no cubre esta factura. Una factura no
          puede liquidar costos por un importe mayor a su subtotal.
        </p>
      )}
    </div>
  );
}
