/**
 * Ola 1 — Brecha de facturación del proveedor: cuánto está comprometido en
 * expedientes y todavía no llegó como factura del proveedor, más las facturas
 * capturadas cuyas partidas no están ligadas a ningún costo.
 */
import { Link } from "react-router-dom";
import { FileWarning, Link2Off, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type {
  BrechaFacturacion,
  FacturaHuerfana,
} from "@/features/proveedor/domain/estadoCuentaProveedor";

interface Props {
  brecha: BrechaFacturacion;
  huerfanas: FacturaHuerfana[];
  proveedorNombre: string;
}

export function ProveedorBrechaCard({ brecha, huerfanas, proveedorNombre }: Props) {
  const montos = Object.entries(brecha.porFacturarPorMoneda).filter(([, m]) => m > 0.01);
  const sinBrecha = montos.length === 0 && huerfanas.length === 0 && brecha.partidasSobrefacturadas === 0;

  if (brecha.totalPartidas === 0) return null;

  if (sinBrecha) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <p className="text-body text-muted-foreground">
            Todo lo comprometido con {proveedorNombre} ya está respaldado con facturas del proveedor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 text-warning shrink-0" />
            <div className="space-y-1">
              <p className="text-body font-medium">Comprometido sin factura del proveedor</p>
              <p className="text-kpi tabular-nums">
                {montos.length > 0
                  ? montos.map(([mon, monto]) => formatCurrency(monto, mon)).join(" · ")
                  : formatCurrency(0, "MXN")}
              </p>
              <p className="text-body-sm text-muted-foreground">
                {brecha.partidasPendientes} de {brecha.totalPartidas} partidas costeadas sin respaldo
                {brecha.partidasSobrefacturadas > 0
                  ? ` · ${brecha.partidasSobrefacturadas} facturada(s) por arriba de lo costeado`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/compras/por-capturar">Ir a Por capturar</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/compras/facturas">Ver facturas</Link>
            </Button>
          </div>
        </div>

        {huerfanas.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-body font-medium text-destructive">
              <Link2Off className="h-4 w-4" />
              {huerfanas.length} factura(s) con partidas sin vincular a un costo
            </div>
            <ul className="mt-2 space-y-1 text-body-sm text-muted-foreground">
              {huerfanas.slice(0, 5).map((h) => (
                <li key={h.factura_id}>
                  <Link className="underline-offset-2 hover:underline" to={`/compras/facturas/${h.factura_id}`}>
                    {h.folio_interno ?? h.folio_proveedor ?? "Sin folio"}
                  </Link>{" "}
                  · {h.partidas} partida(s) · {formatCurrency(h.monto_sin_vincular, h.moneda)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
