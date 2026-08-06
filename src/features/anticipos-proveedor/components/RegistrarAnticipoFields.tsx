/** Campos del formulario "Registrar anticipo a proveedor" (extraído para límite de 200 líneas). */
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { ProveedorCombobox } from "@/features/cxp/components/ProveedorCombobox";
import { formatCurrency } from "@/lib/formatters";
import { METODOS_PAGO, type RegistrarAnticipoFormValues } from "./registrarAnticipo.schema";

interface CuentaOption {
  id: string;
  alias: string;
  banco: string;
  moneda: string;
}

/** Normaliza para comparar sin acentos ni mayúsculas. */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Etiqueta de cuenta sin repetir el banco: muchos alias ya lo incluyen
 * (alias "BASE USD" + banco "BASE" mostraba "BASE USD — BASE (USD)").
 */
export function etiquetaCuenta(c: CuentaOption) {
  const alias = (c.alias ?? "").trim();
  const banco = (c.banco ?? "").trim();
  if (!alias) return `${banco} (${c.moneda})`;
  if (!banco || normalizar(alias).includes(normalizar(banco))) {
    return `${alias} (${c.moneda})`;
  }
  return `${alias} — ${banco} (${c.moneda})`;
}


interface Props {
  control: Control<RegistrarAnticipoFormValues>;
  register: UseFormRegister<RegistrarAnticipoFormValues>;
  errors: FieldErrors<RegistrarAnticipoFormValues>;
  moneda: string;
  requiereCuenta: boolean;
  cuentaBancariaId?: string;
  cuentasDeMoneda: CuentaOption[];
  proveedorNombre: string;
  onProveedorNombre: (nombre: string) => void;
  bloquearProveedor?: boolean;
  /** Origen del tipo de cambio precargado, para mostrarlo como ayuda. */
  tcHint?: string;
  /** Equivalente en pesos del monto capturado (null si no aplica). */
  equivalenteMxn: number | null;
}

export function RegistrarAnticipoFields({
  control, register, errors, moneda, requiereCuenta, cuentaBancariaId,
  cuentasDeMoneda, proveedorNombre, onProveedorNombre, bloquearProveedor,
  tcHint, equivalenteMxn,
}: Props) {
  return (
    <>
      <FormDialogSection title="Datos del anticipo">
        <div className="space-y-1.5">
          <Label>Proveedor</Label>
          {bloquearProveedor ? (
            <Input value={proveedorNombre} readOnly aria-label="Proveedor" />
          ) : (
            <Controller
              control={control}
              name="proveedorId"
              render={({ field }) => (
                <ProveedorCombobox
                  value={field.value}
                  onChange={(id, nombre) => { field.onChange(id); onProveedorNombre(nombre); }}
                  className="w-full"
                />
              )}
            />
          )}
          {errors.proveedorId && <p className="text-xs text-destructive">{errors.proveedorId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ant-fecha">Fecha</Label>
          <Controller
            control={control}
            name="fechaAnticipo"
            render={({ field }) => (
              <DatePickerMx value={field.value ?? ""} onChange={field.onChange} className="w-full" />
            )}
          />
          {errors.fechaAnticipo && <p className="text-xs text-destructive">{errors.fechaAnticipo.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ant-monto">Monto</Label>
          <Input id="ant-monto" type="number" step="0.01" min="0" {...register("monto")} />
          {errors.monto && <p className="text-xs text-destructive">{errors.monto.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Controller
            control={control}
            name="moneda"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {moneda !== "MXN" && (
          <div className="space-y-1.5">
            <Label htmlFor="ant-tc">Tipo de cambio a MXN <span className="text-destructive">*</span></Label>
            <Input id="ant-tc" type="number" step="0.0001" min="0" {...register("tipoCambioUsd")} />
            {errors.tipoCambioUsd
              ? <p className="text-xs text-destructive">{errors.tipoCambioUsd.message}</p>
              : tcHint && <p className="text-xs text-muted-foreground">{tcHint}</p>}
          </div>
        )}
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
          {errors.metodoPago && <p className="text-xs text-destructive">{errors.metodoPago.message}</p>}
        </div>
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
          {cuentasDeMoneda.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay cuentas activas en {moneda}. Créala en Tesorería → Cuentas.
            </p>
          )}
          {requiereCuenta && cuentaBancariaId && (
            <p className="text-xs text-muted-foreground">
              Se registrará el cargo bancario conciliado en esta cuenta.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ant-ref">Referencia</Label>
          <Input id="ant-ref" placeholder="Folio de transferencia, cheque, etc." {...register("referencia")} />
        </div>
      </FormDialogSection>
      {equivalenteMxn !== null && (
        <FormDialogSection title="Resumen" cols={1}>
          <p className="text-sm text-muted-foreground">
            Saldo a favor que quedará disponible:{" "}
            <span className="font-medium text-foreground">{formatCurrency(equivalenteMxn, "MXN")}</span>{" "}
            equivalentes en pesos.
          </p>
        </FormDialogSection>
      )}
      <FormDialogSection title="Notas" cols={1}>
        <Textarea
          rows={3}
          placeholder={`Notas del anticipo${proveedorNombre ? ` para ${proveedorNombre}` : ""}…`}
          {...register("notas")}
        />
      </FormDialogSection>
    </>
  );
}
