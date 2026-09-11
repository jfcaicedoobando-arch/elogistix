/**
 * 13.823.281 — Tipo de cambio de la cotización (paso 3).
 *
 * Sólo se muestra cuando la cotización mezcla conceptos en USD y en MXN: en ese
 * caso el encabezado necesita UNA moneda y el TC congelado permite calcularlo.
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
}

export function TipoCambioCotizacionCard({ value, onChange }: Props) {
  const hoy = hoyMx();
  const { data: dof, isFetching } = useTcDofPorFecha(hoy);
  // Texto crudo mientras se teclea: sin esto, "18." se renderiza como "18"
  // (String(18)) y el siguiente dígito produce "185" en vez de "18.5".
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    setTexto(null);
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
            Esta cotización tiene conceptos en USD y en MXN. Captura el tipo de cambio para
            calcular el total del encabezado en una sola moneda. Los importes de cada concepto
            se conservan en su moneda original.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[16rem_1fr] items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="cot-tc-usd">Tipo de cambio USD/MXN *</Label>
            <Input
              id="cot-tc-usd"
              inputMode="decimal"
              value={texto ?? (value == null ? "" : String(value))}
              placeholder="0.0000"
              onFocus={(e) => setTexto(e.target.value)}
              onBlur={() => setTexto(null)}
              onChange={(e) => {
                const limpio = e.target.value.replace(/[^\d.]/g, "");
                setTexto(limpio);
                const n = Number(limpio);
                onChange(limpio === "" || !Number.isFinite(n) || n <= 0 ? null : n);
              }}
            />
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
