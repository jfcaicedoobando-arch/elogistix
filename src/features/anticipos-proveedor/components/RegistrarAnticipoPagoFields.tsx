/** Campos de método de pago y cuenta bancaria del anticipo (extraído por complejidad). */
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METODOS_PAGO, type RegistrarAnticipoFormValues } from "./registrarAnticipo.schema";
import { etiquetaCuenta, type CuentaOption } from "../domain/etiquetaCuenta";

interface Props {
  control: Control<RegistrarAnticipoFormValues>;
  errors: FieldErrors<RegistrarAnticipoFormValues>;
  moneda: string;
  requiereCuenta: boolean;
  cuentaBancariaId?: string;
  cuentasDeMoneda: CuentaOption[];
}

export function RegistrarAnticipoPagoFields({
  control,
  errors,
  moneda,
  requiereCuenta,
  cuentaBancariaId,
  cuentasDeMoneda,
}: Props) {
  // MNY P1.1: con Efectivo el selector no se muestra y el aviso de "no hay
  // cuentas" no aplica: la falta de cuenta es válida, no un problema a resolver.
  const sinCuentas = requiereCuenta && cuentasDeMoneda.length === 0;
  const mostrarAviso = requiereCuenta && Boolean(cuentaBancariaId);

  return (
    <>
      <div className="space-y-1.5">
        <Label>Método de pago</Label>
        <Controller
          control={control}
          name="metodoPago"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METODOS_PAGO.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.metodoPago && (
          <p className="text-xs text-destructive">{errors.metodoPago.message}</p>
        )}
      </div>
      {!requiereCuenta ? (
        <div className="space-y-1.5">
          <Label>Cuenta bancaria</Label>
          <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
            En efectivo no se usa cuenta bancaria: no se registra ninguna salida de dinero en
            tesorería.
          </p>
        </div>
      ) : (
      <div className="space-y-1.5">
        <Label htmlFor="ant-cuenta">
          Cuenta bancaria {requiereCuenta && <span className="text-destructive">*</span>}
        </Label>
        <Controller
          control={control}
          name="cuentaBancariaId"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id="ant-cuenta">
                <SelectValue placeholder="Selecciona la cuenta de donde sale el dinero" />
              </SelectTrigger>
              <SelectContent>
                {cuentasDeMoneda.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {etiquetaCuenta(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.cuentaBancariaId && (
          <p className="text-xs text-destructive">{errors.cuentaBancariaId.message}</p>
        )}
        {sinCuentas && (
          <p className="text-xs text-warning">
            No hay cuentas activas en {moneda}. Créala en Tesorería → Cuentas.
          </p>
        )}
        {mostrarAviso && (
          <p className="text-xs text-muted-foreground">
            Se registrará el cargo bancario conciliado en esta cuenta.
          </p>
        )}
      </div>
      )}
    </>
  );
}
