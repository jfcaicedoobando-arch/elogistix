/**
 * FacturaResumenCard — "Datos generales" del CFDI (bloque operativo).
 * v13.308.16: los campos fiscales (Uso CFDI / Forma / Método de pago)
 * se movieron a `FacturaTimbradoCard` para separar operativo de fiscal;
 * aquí quedan fechas, crédito, tipo de cambio, referencia BL y notas.
 * v13.351: semáforo de mora (mismo criterio que `BandejaVencidas`) y botón
 * "Enviar recordatorio" reutilizando el flujo de Cobranza.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import { agingVencidoBucket } from "@/features/facturacion/utils/aging";
import { calcularDiasVencidoFactura, puedeEnviarRecordatorio } from "@/features/facturacion/domain/facturaAging";

interface Props {
  factura: FacturaDetalle;
  saldo?: number;
  estaCancelada?: boolean;
  canEnviarRecordatorio?: boolean;
  onEnviarRecordatorio?: () => void;
}

export function FacturaResumenCard({
  factura, saldo = 0, estaCancelada = false, canEnviarRecordatorio = false, onEnviarRecordatorio,
}: Props) {
  const diasVencido = calcularDiasVencidoFactura(factura.fecha_vencimiento);
  const mostrarMora = diasVencido !== null && diasVencido > 0 && saldo > 0.01 && !estaCancelada;
  const mostrarRecordatorio =
    canEnviarRecordatorio && !!onEnviarRecordatorio && puedeEnviarRecordatorio({ saldo, estaCancelada });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold">Datos generales</CardTitle>
        {mostrarRecordatorio && (
          <Button variant="outline" size="sm" onClick={onEnviarRecordatorio}>
            <Mail className="h-4 w-4 mr-1.5" />
            Enviar recordatorio
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Emisión" value={factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"} />
          <Field
            label="Vencimiento"
            value={
              <span className="inline-flex items-center gap-1.5">
                {factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"}
                {mostrarMora && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums whitespace-nowrap ${agingVencidoBucket(diasVencido as number).className}`}
                    aria-label={agingVencidoBucket(diasVencido as number).ariaLabel}
                  >
                    {agingVencidoBucket(diasVencido as number).label}
                  </span>
                )}
              </span>
            }
          />
          <Field label="Días de crédito" value={String(factura.dias_credito ?? 0)} />
          {factura.moneda !== "MXN" ? (
            <Field label="Tipo de cambio" value={`$${Number(factura.tipo_cambio).toFixed(4)}`} />
          ) : (
            <Field label="Moneda" value={factura.moneda} />
          )}
          {factura.referencia_bl && <Field label="Referencia BL" mono value={factura.referencia_bl} />}
        </div>

        {factura.notas && (
          <div className="border-t pt-4">
            <p className="text-label font-medium uppercase tracking-wide text-muted-foreground mb-1">Notas</p>
            <p className="text-sm whitespace-pre-wrap">{factura.notas}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
