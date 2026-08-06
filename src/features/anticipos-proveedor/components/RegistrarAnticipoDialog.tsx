/** Dialog "Registrar anticipo" (QW6). FormDialogShell + RHF + Zod. */
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifyError } from "@/lib/ui/appFeedback";
import { Loader2, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { ProveedorCombobox } from "@/features/cxp/components/ProveedorCombobox";
import { useRegistrarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { todayLocalISO } from "@/lib/date/today";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";

const METODOS_PAGO = ["Transferencia", "Efectivo", "Cheque", "Tarjeta", "Otro"];

const schema = z.object({
  proveedorId: z.string().uuid({ message: "Selecciona un proveedor" }),
  monto: z.coerce.number().positive({ message: "El monto debe ser mayor a cero" }),
  moneda: z.enum(["MXN", "USD", "EUR"]),
  fechaAnticipo: z.string().min(1, "La fecha es requerida"),
  // B-060 (v13.320.32): `metodo_pago` es NOT NULL DEFAULT 'Transferencia' en
  // `pagos_proveedor`. Sin capturarlo aquí, la RPC `aplicar_anticipo_a_factura`
  // insertaba NULL explícito (que anula el default) y el 100% de los anticipos
  // creados por UI eran inaplicables. Ahora es requerido, default 'Transferencia'.
  metodoPago: z.enum(["Transferencia", "Efectivo", "Cheque", "Tarjeta", "Otro"]),
  // Sin cuenta bancaria el anticipo no genera movimiento conciliable en tesorería.
  cuentaBancariaId: z.string().optional(),
  referencia: z.string().optional(),
  notas: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function RegistrarAnticipoDialog({ open, onOpenChange }: Props) {
  const registrar = useRegistrarAnticipo();
  const [proveedorNombre, setProveedorNombre] = useState("");
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      proveedorId: "", monto: 0, moneda: "MXN",
      fechaAnticipo: todayLocalISO(),
      metodoPago: "Transferencia",
      cuentaBancariaId: "",
      referencia: "", notas: "",
    },
  });

  const moneda = watch("moneda");
  const metodoPago = watch("metodoPago");
  const cuentaBancariaId = watch("cuentaBancariaId");
  const requiereCuenta = metodoPago !== "Efectivo";

  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda],
  );

  // Preselección: primera cuenta de la moneda del anticipo. Si la cuenta
  // elegida deja de coincidir con la moneda, se limpia.
  useEffect(() => {
    if (!open) return;
    if (cuentaBancariaId && !cuentasDeMoneda.some((c) => c.id === cuentaBancariaId)) {
      setValue("cuentaBancariaId", "", { shouldValidate: true, shouldDirty: true });
      return;
    }
    if (!cuentaBancariaId && cuentasDeMoneda.length > 0) {
      setValue("cuentaBancariaId", cuentasDeMoneda[0].id, { shouldValidate: true, shouldDirty: true });
    }
  }, [open, cuentaBancariaId, cuentasDeMoneda, setValue]);

  const handleOpenChange = (o: boolean) => {
    if (!o) { reset(); setProveedorNombre(""); }
    onOpenChange(o);
  };

  // B-061: sin handler de inválidos, la promesa de handleSubmit rechazaba
  // en silencio (pageerror con el JSON crudo de zod y cero feedback visible).
  const onInvalid = (errs: FieldErrors<FormValues>) => {
    const first = Object.values(errs)[0];
    notifyError(undefined, {
      title: "Revisa el formulario",
      description: first?.message?.toString() ?? "Hay campos inválidos o incompletos.",
      method: "ANTICIPO_REGISTRAR_FORM_INVALID",
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (values.metodoPago !== "Efectivo" && !values.cuentaBancariaId) {
      notifyError(undefined, {
        title: "Falta la cuenta bancaria",
        description: "Selecciona la cuenta de donde sale el dinero para poder conciliar el anticipo.",
        method: "ANTICIPO_REGISTRAR_SIN_CUENTA",
      });
      return;
    }
    await registrar.mutateAsync({
      proveedorId: values.proveedorId,
      monto: values.monto,
      moneda: values.moneda,
      fechaAnticipo: values.fechaAnticipo,
      metodoPago: values.metodoPago,
      cuentaBancariaId: values.cuentaBancariaId || null,
      referencia: values.referencia || undefined,
      notas: values.notas || undefined,
    });
    handleOpenChange(false);
  }, onInvalid);

  const footer = (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={registrar.isPending}>Cancelar</Button>
      <Button onClick={onSubmit} disabled={registrar.isPending}>
        {registrar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {registrar.isPending ? "Guardando…" : "Registrar anticipo"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={HandCoins}
      title="Registrar anticipo a proveedor"
      description="El anticipo queda disponible para aplicarse a facturas abiertas del mismo proveedor."
      size="lg"
      footer={footer}
    >
      <FormDialogSection title="Datos del anticipo">
        <div className="space-y-1.5">
          <Label>Proveedor</Label>
          <Controller
            control={control}
            name="proveedorId"
            render={({ field }) => (
              <ProveedorCombobox
                value={field.value}
                onChange={(id, nombre) => { field.onChange(id); setProveedorNombre(nombre); }}
                className="w-full"
              />
            )}
          />
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
                      {c.alias} — {c.banco} ({c.moneda})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {cuentasDeMoneda.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay cuentas activas en {moneda}. Créala en Tesorería → Cuentas.
            </p>
          )}
          {requiereCuenta && !cuentaBancariaId && cuentasDeMoneda.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Se registrará el movimiento bancario conciliado en esta cuenta.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ant-ref">Referencia</Label>
          <Input id="ant-ref" placeholder="Folio de transferencia, cheque, etc." {...register("referencia")} />
        </div>
      </FormDialogSection>
      <FormDialogSection title="Notas" cols={1}>
        <Textarea rows={3} placeholder={`Notas del anticipo${proveedorNombre ? ` para ${proveedorNombre}` : ""}…`} {...register("notas")} />
      </FormDialogSection>
    </FormDialogShell>
  );
}
