/** Dialog "Registrar anticipo" (QW6). FormDialogShell + RHF + Zod. */
import { useState } from "react";
import { z } from "zod";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifyError } from "@/lib/ui/appFeedback";
import { Loader2, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { ProveedorCombobox } from "@/features/cxp/components/ProveedorCombobox";
import { useRegistrarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { todayLocalISO } from "@/lib/date/today";

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
  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      proveedorId: "", monto: 0, moneda: "MXN",
      fechaAnticipo: todayLocalISO(),
      metodoPago: "Transferencia",
      referencia: "", notas: "",
    },
  });

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
    await registrar.mutateAsync({
      proveedorId: values.proveedorId,
      monto: values.monto,
      moneda: values.moneda,
      fechaAnticipo: values.fechaAnticipo,
      metodoPago: values.metodoPago,
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
          <Input id="ant-fecha" type="date" {...register("fechaAnticipo")} />
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
