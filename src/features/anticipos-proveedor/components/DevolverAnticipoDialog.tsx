/**
 * N13 · "Registrar devolución" de un anticipo de proveedor.
 *
 * Cancelar es romper el cheque antes de entregarlo; devolver es que el
 * proveedor te deposite de vuelta lo que le sobró: el pago sí ocurrió, así que
 * conservamos el movimiento original y damos entrada al reembolso.
 */
import { useEffect, useState } from "react";
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
import { FormDialogShell, FormDialogSection } from "@/components/shared/FormDialogShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { useDevolverAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { etiquetaCuenta } from "@/features/anticipos-proveedor/domain/etiquetaCuenta";
import { formatCurrency } from "@/lib/formatters";
import { hoyMx } from "@/lib/date/mx";
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  anticipo: AnticipoProveedorRow | null;
}

export function DevolverAnticipoDialog({ open, onOpenChange, anticipo }: Props) {
  const devolver = useDevolverAnticipo();
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const [monto, setMonto] = useState<number | null>(null);
  const [fecha, setFecha] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [motivo, setMotivo] = useState("");

  const disponible = anticipo?.disponible ?? 0;
  const moneda = anticipo?.moneda ?? "MXN";
  const cuentasDeMoneda = cuentas.filter((c) => c.moneda === moneda);

  // Al abrir se propone devolver todo el saldo con fecha de hoy y la primera
  // cuenta de la misma moneda: el caso normal es "me regresaron el remanente".
  useEffect(() => {
    if (!open || !anticipo) return;
    setMonto(disponible > 0 ? disponible : null);
    setFecha(hoyMx());
    setCuentaId(cuentasDeMoneda[0]?.id ?? "");
    setReferencia("");
    setMotivo("");
    // cuentasDeMoneda se recalcula en cada render; basta la primera opción al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anticipo?.id]);

  const excede = (monto ?? 0) > disponible + 0.01;

  const handleConfirm = async () => {
    if (!anticipo) return;
    if (!monto || monto <= 0 || excede) {
      notifyWarning(undefined, {
        title: "Revisa el monto",
        description: `La devolución debe ser mayor a cero y no puede exceder el saldo disponible (${formatCurrency(disponible, moneda)}).`,
      });
      return;
    }
    if (!fecha) {
      notifyWarning(undefined, { title: "Falta la fecha", description: "Indica cuándo entró el depósito." });
      return;
    }
    if (!cuentaId) {
      notifyWarning(undefined, {
        title: "Falta la cuenta",
        description: "Selecciona la cuenta bancaria donde entró el dinero.",
      });
      return;
    }
    if (motivo.trim().length < 3) {
      notifyWarning(undefined, {
        title: "Indica un motivo",
        description: "Escribe el motivo de la devolución (al menos 3 caracteres).",
      });
      return;
    }
    await devolver.mutateAsync({
      id: anticipo.id,
      monto,
      fecha,
      cuentaBancariaId: cuentaId,
      referencia: referencia.trim() || null,
      motivo: motivo.trim(),
    });
    onOpenChange(false);
  };

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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={devolver.isPending}>
            Volver
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={devolver.isPending}>
            {devolver.isPending ? "Registrando…" : "Registrar devolución"}
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
              value={monto}
              onChange={setMonto}
              currency={moneda}
              max={disponible}
              aria-invalid={excede}
            />
            <p className={excede ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              Saldo disponible: {formatCurrency(disponible, moneda)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-fecha">Fecha de la devolución</Label>
            <DatePickerMx
              id="dev-fecha"
              value={fecha}
              onChange={setFecha}
              min={anticipo.fecha_anticipo ?? undefined}
              aria-label="Fecha de la devolución"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dev-cuenta">Cuenta bancaria donde entró el dinero</Label>
            <Select value={cuentaId} onValueChange={setCuentaId}>
              <SelectTrigger id="dev-cuenta">
                <SelectValue placeholder={`Selecciona una cuenta en ${moneda}`} />
              </SelectTrigger>
              <SelectContent>
                {cuentasDeMoneda.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {etiquetaCuenta(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cuentasDeMoneda.length === 0 && (
              <p className="text-xs text-destructive">
                No hay cuentas bancarias activas en {moneda}. Regístrala en Tesorería antes de
                continuar.
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dev-referencia">Referencia bancaria (opcional)</Label>
            <Input
              id="dev-referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
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
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. El servicio no se realizó; el proveedor reembolsó el remanente."
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
