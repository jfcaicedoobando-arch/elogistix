/** Dialog "Aplicar anticipo a factura" (QW6). FormDialogShell + RHF + Zod. */
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifyError } from "@/lib/ui/appFeedback";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { SelectorFacturaAbierta } from "@/features/anticipos-proveedor/components/SelectorFacturaAbierta";
import { useAplicarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { formatCurrency } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { hoyMx } from "@/lib/date/mx";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";
import { buildSchema } from "../domain/aplicarAnticipoSchema";
import { calcularTopeAplicable } from "../domain/topeAplicacionAnticipo";
import { useTcDofPorFecha } from "@/features/catalogos/hooks";

type FormInput = z.input<ReturnType<typeof buildSchema>>;
type FormValues = z.output<ReturnType<typeof buildSchema>>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  anticipo: AnticipoProveedorRow | null;
}

export function AplicarAnticipoDialog({ open, onOpenChange, anticipo }: Props) {
  const aplicar = useAplicarAnticipo();
  const saldoDisponible = anticipo?.disponible ?? 0;
  const monedaAnticipo = anticipo?.moneda ?? "MXN";
  const [fechaTope, setFechaTope] = useState(todayLocalISO());
  const [saldoFacturaTope, setSaldoFacturaTope] = useState(0);
  const [monedaFacturaTope, setMonedaFacturaTope] = useState("MXN");
  // MNY P1.3: el tope se calcula con el DOF de la FECHA DE APLICACIÓN, igual
  // que la valuación del servidor. Sin paridad no se adivina un 1:1.
  const { data: tcDof } = useTcDofPorFecha(fechaTope);
  const tope = useMemo(
    () =>
      calcularTopeAplicable({
        disponible: saldoDisponible,
        monedaAnticipo,
        saldoFactura: saldoFacturaTope,
        monedaFactura: monedaFacturaTope,
        tc: tcDof ?? null,
      }),
    [saldoDisponible, monedaAnticipo, saldoFacturaTope, monedaFacturaTope, tcDof],
  );
  const schema = useMemo(
    () => buildSchema(saldoDisponible, monedaAnticipo, tope.tope),
    [saldoDisponible, monedaAnticipo, tope.tope],
  );

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      facturaId: "", saldoFactura: 0, monedaFactura: "MXN",
      monto: 0, fechaAplicacion: todayLocalISO(),
    },
  });

  useEffect(() => {
    if (!open) return;
    setSaldoFacturaTope(0);
    setMonedaFacturaTope("MXN");
    setFechaTope(todayLocalISO());
    reset({ facturaId: "", saldoFactura: 0, monedaFactura: "MXN", monto: 0, fechaAplicacion: todayLocalISO() });
  }, [open, reset]);

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const facturaId = watch("facturaId");
  const monedaFactura = watch("monedaFactura");
  const fechaAplicacion = watch("fechaAplicacion");
  useEffect(() => {
    if (fechaAplicacion) setFechaTope(fechaAplicacion);
  }, [fechaAplicacion]);
  const monedaDifiere = Boolean(anticipo) && monedaFactura && anticipo!.moneda !== monedaFactura;

  // B-061: handler de inválidos — el JSON crudo de zod ya no se traga.
  const onInvalid = (errs: FieldErrors<FormInput>) => {
    const first = Object.values(errs)[0];
    notifyError(undefined, {
      title: "Revisa el formulario",
      description: first?.message?.toString() ?? "Hay campos inválidos o incompletos.",
      method: "ANTICIPO_APLICAR_FORM_INVALID",
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!anticipo) return;
    await aplicar.mutateAsync({
      anticipoId: anticipo.id,
      facturaId: values.facturaId,
      monto: values.monto,
      fechaAplicacion: values.fechaAplicacion,
    });
    handleOpenChange(false);
  }, onInvalid);

  const footer = (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={aplicar.isPending}>Cancelar</Button>
      <Button onClick={onSubmit} disabled={!facturaId} loading={aplicar.isPending}>
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
                  setSaldoFacturaTope(saldo);
                  setMonedaFacturaTope(moneda);
                }}
              />
            )}
          />
          {errors.facturaId && <p className="text-xs text-destructive">{errors.facturaId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-fecha">Fecha de aplicación</Label>
          <Controller
            control={control}
            name="fechaAplicacion"
            render={({ field }) => (
              <DatePickerMx
                id="apl-fecha"
                name="fechaAplicacion"
                value={field.value ?? ""}
                onChange={field.onChange}
                max={hoyMx()}
                className="w-full"
              />
            )}
          />
          {errors.fechaAplicacion && <p className="text-xs text-destructive">{errors.fechaAplicacion.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apl-monto">Monto a aplicar ({anticipo.moneda})</Label>
          <Input id="apl-monto" type="number" step="0.01" min="0" {...register("monto")} />
          {errors.monto && <p className="text-xs text-destructive">{errors.monto.message}</p>}
        </div>
        {monedaDifiere && (
          <p className="text-xs text-muted-foreground md:col-span-2">
            Capturas el monto en {anticipo.moneda} y la factura está en {monedaFactura}.{" "}
            {tope.sinTipoCambio
              ? `No hay tipo de cambio oficial para el ${fechaTope}: captúralo antes de aplicar.`
              : `Con el tipo de cambio oficial del ${fechaTope} puedes aplicar hasta ${formatCurrency(tope.tope ?? 0, anticipo.moneda)}.`}
          </p>
        )}
      </FormDialogSection>
    </FormDialogShell>
  );
}
