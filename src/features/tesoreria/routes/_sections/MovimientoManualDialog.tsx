/**
 * Diálogo de captura de movimiento manual (conciliación bancaria).
 * Extraído de `TesoreriaConciliacion` para bajar su complejidad y tamaño.
 */
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  validarMovimientoManual,
  type MovimientoManualInput,
} from "@/features/tesoreria/domain/movimientoManual";
import type { CuentaBancaria } from "@/features/tesoreria/services";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuentas: CuentaBancaria[];
  manualForm: Partial<MovimientoManualInput>;
  setManualField: <K extends keyof MovimientoManualInput>(key: K, value: MovimientoManualInput[K]) => void;
  onGuardar: () => void;
  isPending: boolean;
}

export function MovimientoManualDialog({
  open, onOpenChange, cuentas, manualForm, setManualField, onGuardar, isPending,
}: Props) {
  const erroresManual = validarMovimientoManual(manualForm);
  const manualEsValido = Object.keys(erroresManual).length === 0;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Landmark}
      title="Registrar movimiento manual"
      description="Captura fuera del importador (ajustes, comisiones, depósitos manuales)."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onGuardar} disabled={!manualEsValido || isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
      <div
        className="grid grid-cols-2 gap-3"
        onKeyDown={(e) => {
          // Enter en cualquier campo guarda (sin cerrar el modal a ciegas).
          if (e.key === "Enter" && !e.shiftKey && manualEsValido && !isPending) {
            const t = e.target as HTMLElement;
            if (t.tagName === "INPUT") {
              e.preventDefault();
              onGuardar();
            }
          }
        }}
      >
        <div className="col-span-2">
          <Label htmlFor="mov-cuenta">Cuenta bancaria *</Label>
          <Select
            value={manualForm.cuentaBancariaId ?? ""}
            onValueChange={(v) => setManualField("cuentaBancariaId", v)}
          >
            <SelectTrigger id="mov-cuenta"><SelectValue placeholder="Selecciona cuenta..." /></SelectTrigger>
            <SelectContent>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.banco} · {c.alias} ({c.moneda})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="mov-fecha">Fecha *</Label>
          <DatePickerMx
            value={manualForm.fecha ?? ""}
            onChange={(v) => setManualField("fecha", v)}
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor="mov-tipo">Tipo *</Label>
          <Select
            value={manualForm.tipo ?? "cargo"}
            onValueChange={(v) => setManualField("tipo", v as "cargo" | "abono")}
          >
            <SelectTrigger id="mov-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cargo">Cargo</SelectItem>
              <SelectItem value="abono">Abono</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label htmlFor="mov-concepto">Concepto *</Label>
          <Input
            id="mov-concepto"
            value={manualForm.concepto ?? ""}
            onChange={(e) => setManualField("concepto", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="mov-referencia">Referencia</Label>
          <Input
            id="mov-referencia"
            value={manualForm.referencia ?? ""}
            onChange={(e) => setManualField("referencia", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="mov-importe">Importe *</Label>
          <MoneyInput
            id="mov-importe"
            value={manualForm.monto ?? null}
            onChange={(n) => setManualField("monto", n)}
            currency={monedaCuenta}
            aria-invalid={!!erroresManual.monto}
            aria-describedby={erroresManual.monto ? "mov-importe-error" : undefined}
          />
          {erroresManual.monto && (
            <p id="mov-importe-error" className="mt-1 text-xs text-destructive">
              {erroresManual.monto}
            </p>
          )}
        </div>
      </div>

    </FormDialogShell>
  );
}
