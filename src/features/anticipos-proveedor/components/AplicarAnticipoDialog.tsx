/** Dialog "Aplicar anticipo a factura" (QW6). FormDialogShell + RHF + Zod. */
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { SelectorFacturaAbierta } from "@/features/anticipos-proveedor/components/SelectorFacturaAbierta";
import { useAplicarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { formatCurrency } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

function buildSchema(saldoDisponible: number) {
  return z.object({
    facturaId: z.string().uuid({ message: "Selecciona una factura" }),
    saldoFactura: z.number(),
    monedaFactura: z.string(),
    monto: z.coerce.number()
      .positive({ message: "El monto debe ser mayor a cero" })
      .max(saldoDisponible, { message: `No puede exceder el saldo disponible del anticipo (${formatCurrency(saldoDisponible, "MXN")})` }),
    fechaAplicacion: z.string().min(1, "La fecha es requerida"),
  }).refine((v) => v.monto <= v.saldoFactura + 0.01, {
    message: "El monto no puede exceder el saldo de la factura",
    path: ["monto"],
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  anticipo: AnticipoProveedorRow | null;
}

export function AplicarAnticipoDialog({ open, onOpenChange, anticipo }: Props) {
  const aplicar = useAplicarAnticipo();
  const saldoDisponible = anticipo?.disponible ?? 0;
  const schema = useMemo(() => buildSchema(saldoDisponible), [saldoDisponible]);

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      facturaId: "", saldoFactura: 0, monedaFactura: "MXN",
      monto: 0, fechaAplicacion: todayLocalISO(),
    },
  });

  useEffect(() => {
    if (open) reset({ facturaId: "", saldoFactura: 0, monedaFactura: "MXN", monto: 0, fechaAplicacion: todayLocalISO() });
  }, [open, reset]);

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const facturaId = watch("facturaId");
  const monedaFactura = watch("monedaFactura");
  const monedaDifiere = Boolean(anticipo) && monedaFactura && anticipo!.moneda !== monedaFactura;

  const onSubmit = handleSubmit(async (values) => {
    if (!anticipo) return;
    await aplicar.mutateAsync({
      anticipoId: anticipo.id,
      facturaId: values.facturaId,
      monto: values.monto,
      fechaAplicacion: values.fechaAplicacion,
    });
    handleOpenChange(false);
  });

  const footer = (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={aplicar.isPending}>Cancelar</Button>
      <Button onClick={onSubmit} disabled={aplicar.isPending || !facturaId}>
        {aplicar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {aplicar.isPending ? "Aplicando…" : "Aplicar anticipo"}
      </Button>
    </>
  );

  if (!anticipo) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={ArrowRightLeft}
      title="Aplicar anticipo a factura"
      description={`Saldo disponible del anticipo: ${formatCurrency(saldoDisponible, anticipo.moneda)} (${anticipo.proveedor_nombre ?? "proveedor"}).`}
      size="lg"
      footer={footer}
    >
      <FormDialogSection title="Factura destino">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Factura abierta</Label>
          <Controller
            control={control}
            name="facturaId"
            render={({ field }) => (
              <SelectorFacturaAbierta
                proveedorId={anticipo.proveedor_id}
                value={field.value}
                onChange={(id, saldo, moneda) => {
                  field.onChange(id);
                  setValue("saldoFactura", saldo);
                  setValue("monedaFactura", moneda);
                }}
              />
            )}
          />
          {errors.facturaId && <p className="text-xs text-destructive">{errors.facturaId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-fecha">Fecha de aplicación</Label>
          <Input id="apl-fecha" type="date" {...register("fechaAplicacion")} />
          {errors.fechaAplicacion && <p className="text-xs text-destructive">{errors.fechaAplicacion.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-monto">Monto a aplicar</Label>
          <Input id="apl-monto" type="number" step="0.01" min="0" {...register("monto")} />
          {errors.monto && <p className="text-xs text-destructive">{errors.monto.message}</p>}
        </div>
        {monedaDifiere && (
          <p className="text-xs text-muted-foreground md:col-span-2">
            El anticipo está en {anticipo.moneda} y la factura en {monedaFactura}. La conversión de moneda la realiza
            el servidor al aplicar (RPC <code>aplicar_anticipo_a_factura</code>).
          </p>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
