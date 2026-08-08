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
import { type RegistrarAnticipoFormValues } from "./registrarAnticipo.schema";
import { EmbarqueAnticipoPicker } from "./EmbarqueAnticipoPicker";
import { RegistrarAnticipoPagoFields } from "./RegistrarAnticipoPagoFields";
import { type CuentaOption } from "../domain/etiquetaCuenta";


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
  /** Embarque ligado al anticipo (opcional). */
  embarqueId?: string | null;
  embarqueExpediente?: string | null;
  onEmbarqueChange: (embarqueId: string | null, expediente: string | null) => void;
}

export function RegistrarAnticipoFields({
  control, register, errors, moneda, requiereCuenta, cuentaBancariaId,
  cuentasDeMoneda, proveedorNombre, onProveedorNombre, bloquearProveedor,
  tcHint, equivalenteMxn, embarqueId, embarqueExpediente, onEmbarqueChange,
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
        <RegistrarAnticipoPagoFields
          control={control}
          errors={errors}
          moneda={moneda}
          requiereCuenta={requiereCuenta}
          cuentaBancariaId={cuentaBancariaId}
          cuentasDeMoneda={cuentasDeMoneda}
        />

        <div className="space-y-1.5">
          <Label htmlFor="ant-ref">Referencia</Label>
          <Input id="ant-ref" placeholder="Folio de transferencia, cheque, etc." {...register("referencia")} />
        </div>
      </FormDialogSection>
      <FormDialogSection title="Vinculación con embarque (opcional)" cols={1}>
        <EmbarqueAnticipoPicker
          value={embarqueId ?? null}
          expediente={embarqueExpediente ?? null}
          onChange={onEmbarqueChange}
        />
        <p className="text-xs text-muted-foreground">
          Sirve para saber de qué expediente es el dinero adelantado y amarrarlo después con la
          factura del proveedor. Puedes dejarlo vacío y ligarlo más tarde.
        </p>
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
