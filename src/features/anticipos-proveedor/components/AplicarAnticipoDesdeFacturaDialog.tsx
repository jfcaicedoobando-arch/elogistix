/**
 * Aplicar un anticipo desde el detalle de la factura de proveedor.
 * La factura es fija: sólo se elige el anticipo con saldo a favor y el monto.
 * El estado y las validaciones viven en `useAplicarAnticipoDesdeFactura`.
 */
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { esMismoEmbarque } from "@/features/anticipos-proveedor/domain/ordenAnticiposPorEmbarque";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { useAplicarAnticipoDesdeFactura } from "@/features/anticipos-proveedor/hooks/useAplicarAnticipoDesdeFactura";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";
import {
  AplicarAnticipoResumen,
  type ImportesFactura,
} from "@/features/anticipos-proveedor/components/AplicarAnticipoResumen";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  folioFactura: string;
  /** Desglose completo de importes de la factura (subtotal → saldo por pagar). */
  importes: ImportesFactura;
  anticipos: AnticipoProveedorRow[];
  /** Embarque de la factura, para avisar si no coincide con el del anticipo. */
  facturaEmbarqueId?: string | null;
  facturaExpediente?: string | null;
}

export function AplicarAnticipoDesdeFacturaDialog({
  open, onOpenChange, facturaId, folioFactura, importes, anticipos,
  facturaEmbarqueId, facturaExpediente,
}: Props) {
  const f = useAplicarAnticipoDesdeFactura({
    open,
    onOpenChange,
    facturaId,
    saldoFactura: importes.saldo,
    monedaFactura: importes.moneda,
    anticipos,
    facturaEmbarqueId,
    facturaExpediente,
  });

  const footer = (
    <>
      <Button variant="outline" onClick={() => f.handleOpenChange(false)} disabled={f.isPending}>
        Cancelar
      </Button>
      <Button onClick={f.onSubmit} disabled={!f.anticipoId} loading={f.isPending}>
        {f.isPending ? "Aplicando…" : "Aplicar anticipo"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={f.handleOpenChange}
      icon={ArrowRightLeft}
      title="Aplicar anticipo a esta factura"
      description={`Factura ${folioFactura} · revisa el desglose antes de aplicar.`}
      size="lg"
      footer={footer}
    >
      <FormDialogSection title="Importes">
        <AplicarAnticipoResumen
          factura={importes}
          anticipo={f.anticipo}
          montoAplicar={Number.isFinite(f.montoNum) ? f.montoNum : 0}
        />
      </FormDialogSection>

      <FormDialogSection title="Anticipo a aplicar">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="apl-anticipo">Anticipo con saldo a favor</Label>
          <Select value={f.anticipoId} onValueChange={f.setAnticipoId}>
            <SelectTrigger id="apl-anticipo">
              <SelectValue placeholder="Selecciona un anticipo" />
            </SelectTrigger>
            <SelectContent>
              {f.anticiposOrdenados.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {formatDate(a.fecha_anticipo)} · {formatCurrency(a.disponible, a.moneda)} disponibles
                  {a.referencia ? ` · Ref. ${a.referencia}` : ""}
                  {esMismoEmbarque(a.embarque_id, facturaEmbarqueId ?? null)
                    ? " · Mismo expediente"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-fecha-f">Fecha de aplicación</Label>
          <DatePickerMx
            id="apl-fecha-f"
            name="fechaAplicacion"
            value={f.fecha}
            onChange={f.setFecha}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-monto-f">
            Monto a aplicar en {f.anticipo?.moneda ?? importes.moneda} (moneda del anticipo)
          </Label>
          <Input
            id="apl-monto-f"
            type="number"
            step="0.01"
            min="0"
            value={f.monto}
            onChange={(e) => f.setMonto(e.target.value)}
          />
          {f.anticipo && f.tope.requiereConversion && (
            <p className="text-xs text-muted-foreground">
              {f.tope.sinTipoCambio
                ? `Sin tipo de cambio oficial del ${f.fecha} no se puede convertir el saldo de la factura (${importes.moneda}).`
                : `Máximo aplicable con el tipo de cambio del ${f.fecha}: ${formatCurrency(f.tope.tope ?? 0, f.anticipo.moneda)}.`}
            </p>
          )}
        </div>
        {f.desajuste.hayDesajuste && (
          <div className="md:col-span-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-foreground">{f.desajuste.mensaje}</p>
          </div>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
