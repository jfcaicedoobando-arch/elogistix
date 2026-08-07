/**
 * Selector de cuenta bancaria del pago a proveedor.
 * Extraído de PagoProveedorFormBody (v13.452.1) para bajar la complejidad
 * ciclomática del cuerpo del formulario por debajo del límite de arquitectura.
 */
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AvisoFechaPreviaCorte } from "@/components/shared/AvisoFechaPreviaCorte";
import type { PagoProveedorFormBodyProps } from "./PagoProveedorFormBody.types";

type Props = Pick<
  PagoProveedorFormBodyProps,
  "cuentas" | "cuentaId" | "setCuentaId" | "requiereCuenta" | "fecha"
>;

export function PagoProveedorCuentaField(p: Props) {
  const cuenta = p.cuentas.find((c) => c.id === p.cuentaId);
  return (
    <div className="space-y-1">
      <Label htmlFor="cuenta-bancaria">
        Cuenta bancaria{p.requiereCuenta ? " *" : " (opcional)"}
      </Label>
      <Select value={p.cuentaId} onValueChange={p.setCuentaId}>
        <SelectTrigger id="cuenta-bancaria">
          <SelectValue placeholder="Selecciona la cuenta de donde sale el pago" />
        </SelectTrigger>
        <SelectContent>
          {p.cuentas.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.banco} · {c.alias ?? "Cuenta"} ({c.moneda})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {p.requiereCuenta && !p.cuentaId && (
        <p className="text-xs text-destructive">
          Selecciona la cuenta bancaria de donde sale el pago.
        </p>
      )}
      {p.cuentaId && (
        <p className="text-label text-muted-foreground">
          Se registrará el movimiento bancario conciliado en esta cuenta.
        </p>
      )}
      <AvisoFechaPreviaCorte
        fecha={p.fecha}
        corte={cuenta?.fecha_saldo_inicial}
        aliasCuenta={cuenta?.alias}
      />
    </div>
  );
}
