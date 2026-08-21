/**
 * v13.507.0 — Coteja el importe capturado contra el monto que operaciones
 * declaró al subir el documento al buzón. Informa, nunca bloquea.
 */
import { formatPercent } from "@/lib/formatters";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters/numbers";
import { cotejarMontoDeclarado } from "@/features/cxp/domain/montoDeclarado";

interface Props {
  montoDeclarado: number | null | undefined;
  monedaDeclarada: string | null | undefined;
  montoCapturado: number;
  monedaCapturada: string;
}

export function AvisoMontoDeclarado({
  montoDeclarado, monedaDeclarada, montoCapturado, monedaCapturada,
}: Props) {
  const cotejo = cotejarMontoDeclarado({
    montoDeclarado, monedaDeclarada, montoCapturado, monedaCapturada,
  });
  if (cotejo.estado === "sin_datos") return null;

  const declarado = formatCurrency(Number(montoDeclarado), monedaDeclarada ?? "MXN");
  const capturado = formatCurrency(montoCapturado, monedaCapturada);

  if (cotejo.estado === "moneda_distinta") {
    return (
      <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-body-sm text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Operaciones declaró {declarado} y la factura está en {monedaCapturada}: no se puede comparar
        directamente.
      </p>
    );
  }

  if (cotejo.estado === "coincide") {
    return (
      <Alert variant="success" className="px-3 py-2 [&>svg]:left-3 [&>svg]:top-2.5">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        <AlertDescription className="text-body-sm">
          Coincide con lo declarado por operaciones ({declarado}).
        </AlertDescription>
      </Alert>
    );
  }

  const signo = cotejo.diferencia > 0 ? "+" : "−";
  const pct = formatPercent(cotejo.porcentaje * 100);
  return (
    <Alert variant="warning" className="px-3 py-2 [&>svg]:left-3 [&>svg]:top-2.5">
      <AlertTriangle className="h-4 w-4" aria-hidden />
      <AlertDescription className="text-body-sm">
        Operaciones declaró {declarado} y la factura suma {capturado} ({signo}
        {formatCurrency(Math.abs(cotejo.diferencia), monedaCapturada)} · {pct}). Verifica antes de
        guardar.
      </AlertDescription>
    </Alert>
  );
}
