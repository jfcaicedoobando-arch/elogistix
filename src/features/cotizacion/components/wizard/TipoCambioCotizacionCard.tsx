/**
 * 13.823.281 — Tipo de cambio de la cotización (paso 3).
 *
 * Se muestra cuando hay mezcla o una venta en divisa distinta de la cabecera
 * fija de Pricing; el TC explícito permite calcular el subtotal canónico.
 * Los conceptos NO se convierten: cada renglón conserva su moneda e importe.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTcDofPorFecha } from "@/features/catalogos/hooks";
import { hoyMx } from "@/lib/date/mx";
import { formatDate } from "@/lib/formatters";

interface Props {
  /** TC USD/MXN capturado en la cotización (`null` = sin capturar). */
  value: number | null;
  onChange: (v: number | null) => void;
  monedaCanonica?: string | null;
}

/** Valida la entrada completa: nunca convierte «-1» en 1 ni «20,5» en 205. */
function tipoCambioDesdeTexto(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function TipoCambioCotizacionCard({ value, onChange, monedaCanonica }: Props) {
  const hoy = hoyMx();
  const { data: dof, isFetching } = useTcDofPorFecha(hoy);
  // Texto crudo mientras se teclea: sin esto, "18." se renderiza como "18"
  // (String(18)) y el siguiente dígito produce "185" en vez de "18.5".
  const [texto, setTexto] = useState<string | null>(null);
  const [errorCaptura, setErrorCaptura] = useState(false);

  useEffect(() => {
    // Conservar «-» al invalidar un TC previo: el siguiente dígito no puede volverse positivo.
    setTexto(actual => value == null && actual?.trim() && tipoCambioDesdeTexto(actual) == null ? actual : null);
    if (value != null && Number.isFinite(value) && value > 0) setErrorCaptura(false);
  }, [value]);

  return (
    <Card data-testid="tc-cotizacion-card">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Tipo de cambio de la cotización</CardTitle>
          {dof?.usdMxn ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(dof.usdMxn)}
              disabled={isFetching}
            >
              <RefreshCw className="size-4 mr-1" /> Traer TC DOF de hoy
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body-sm text-foreground">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            {monedaCanonica
              ? `La moneda de Pricing es ${monedaCanonica}. Captura el tipo de cambio para calcular el subtotal del encabezado en esa moneda.`
              : "Esta cotización tiene conceptos en USD y en MXN. Captura el tipo de cambio para calcular el total del encabezado en una sola moneda."}
            {" "}Los importes de cada concepto se conservan en su moneda original.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[16rem_1fr] items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="cot-tc-usd">Tipo de cambio USD/MXN *</Label>
            <Input
              id="cot-tc-usd"
              inputMode="decimal"
              aria-invalid={errorCaptura}
              aria-describedby={errorCaptura ? "cot-tc-usd-error" : undefined}
              value={texto ?? (value == null ? "" : String(value))}
              placeholder="0.0000"
              onFocus={(e) => setTexto(e.target.value)}
              onBlur={() => { if (!errorCaptura) setTexto(null); }}
              onChange={(e) => {
                const entrada = e.target.value;
                setTexto(entrada);
                const n = tipoCambioDesdeTexto(entrada);
                setErrorCaptura(entrada.trim() !== "" && n == null);
                onChange(n);
              }}
            />
            {errorCaptura && <p id="cot-tc-usd-error" role="alert" className="text-body-sm text-destructive">Captura un número mayor que cero, usando punto para los decimales.</p>}
          </div>
          <p className="text-body-sm text-muted-foreground">
            {dof?.usdMxn
              ? `DOF ${dof.usdMxn.toFixed(4)} publicado el ${formatDate(dof.fecha)}.`
              : "No hay tipo de cambio DOF disponible; captúralo manualmente."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
