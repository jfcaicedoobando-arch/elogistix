/**
 * N13 · "Registrar devolución" de un anticipo de proveedor.
 *
 * Cancelar es romper el cheque antes de entregarlo; devolver es que el
 * proveedor te deposite de vuelta lo que le sobró: el pago sí ocurrió, así que
 * conservamos el movimiento original y damos entrada al reembolso.
 *
 * El estado y las validaciones viven en `useDevolverAnticipoForm.ts`.
 */
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { useDevolverAnticipoForm } from "@/features/anticipos-proveedor/hooks/useDevolverAnticipoForm";
import { etiquetaCuenta } from "@/features/anticipos-proveedor/domain/etiquetaCuenta";
import { formatCurrency } from "@/lib/formatters";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  anticipo: AnticipoProveedorRow | null;
}

export function DevolverAnticipoDialog({ open, onOpenChange, anticipo }: Props) {
  const f = useDevolverAnticipoForm({ open, anticipo, onOpenChange });

  if (!anticipo) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Undo2}
      title="Registrar devolución del anticipo"
      description={
        <>
          {anticipo.proveedor_nombre ?? "El proveedor"} regresó el dinero. El anticipo quedará como{" "}
          <strong>devuelto</strong> con saldo cero y el depósito aparecerá en tesorería pendiente de
          conciliar. Las aplicaciones ya hechas y el pago original no se modifican.
        </>
      }
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={f.isPending}>
            Volver
          </Button>
          <Button onClick={() => void f.handleConfirm()} disabled={f.isPending}>
            {f.isPending ? "Registrando…" : "Registrar devolución"}
          </Button>
        </>
      }
    >
      <FormDialogSection title="Depósito recibido">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dev-monto">Monto devuelto</Label>
            <MoneyInput
              id="dev-monto"
              value={f.monto}
              onChange={f.setMonto}
              currency={f.moneda}
              max={f.disponible}
              disabled
              aria-invalid={f.excede}
            />
            <p className="text-xs text-muted-foreground">
              La devolución es por el saldo completo: {formatCurrency(f.disponible, f.moneda)}.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-fecha">Fecha de la devolución</Label>
            <DatePickerMx
              id="dev-fecha"
              value={f.fecha}
              onChange={f.setFecha}
              min={anticipo.fecha_anticipo ?? undefined}
              aria-label="Fecha de la devolución"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dev-cuenta">Cuenta bancaria donde entró el dinero</Label>
            <Select value={f.cuentaId} onValueChange={f.setCuentaId}>
              <SelectTrigger id="dev-cuenta">
                <SelectValue placeholder={`Selecciona una cuenta en ${f.moneda}`} />
              </SelectTrigger>
              <SelectContent>
                {f.cuentasDeMoneda.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {etiquetaCuenta(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {f.cuentasDeMoneda.length === 0 && (
              <p className="text-xs text-destructive">
                No hay cuentas bancarias activas en {f.moneda}. Regístrala en Tesorería antes de
                continuar.
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dev-referencia">Referencia bancaria (opcional)</Label>
            <Input
              id="dev-referencia"
              value={f.referencia}
              onChange={(e) => f.setReferencia(e.target.value)}
              placeholder="Ej. SPEI 4821990"
            />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection title="Motivo">
        <div className="space-y-1.5">
          <Label htmlFor="dev-motivo">¿Por qué nos devolvieron el anticipo?</Label>
          <Textarea
            id="dev-motivo"
            rows={3}
            value={f.motivo}
            onChange={(e) => f.setMotivo(e.target.value)}
            placeholder="Ej. El servicio no se realizó; el proveedor reembolsó el remanente."
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
