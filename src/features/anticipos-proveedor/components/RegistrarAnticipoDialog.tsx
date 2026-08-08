/** Dialog "Registrar anticipo" (QW6). FormDialogShell + RHF + Zod. */
import { useEffect, useMemo, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifyError } from "@/lib/ui/appFeedback";
import { Loader2, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useRegistrarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { todayLocalISO } from "@/lib/date/today";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useTcInicial } from "@/features/catalogos/hooks";
import { RegistrarAnticipoFields } from "./RegistrarAnticipoFields";
import { registrarAnticipoSchema, type RegistrarAnticipoFormValues } from "./registrarAnticipo.schema";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Preselecciona (y fija) el proveedor, p.ej. al abrirlo desde su detalle. */
  proveedorIdInicial?: string;
  proveedorNombreInicial?: string;
}

export function RegistrarAnticipoDialog({
  open, onOpenChange, proveedorIdInicial, proveedorNombreInicial,
}: Props) {
  const registrar = useRegistrarAnticipo();
  const [proveedorNombre, setProveedorNombre] = useState(proveedorNombreInicial ?? "");
  const { data: cuentas = [] } = useCuentasBancarias(true);
  const { data: tc } = useTcInicial();

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<RegistrarAnticipoFormValues>({
      resolver: zodResolver(registrarAnticipoSchema),
      defaultValues: {
        proveedorId: proveedorIdInicial ?? "", monto: 0, moneda: "MXN",
        fechaAnticipo: todayLocalISO(),
        metodoPago: "Transferencia",
        cuentaBancariaId: "",
        tipoCambioUsd: undefined,
        referencia: "", notas: "",
        embarqueId: null, embarqueExpediente: null,

      },
    });

  const moneda = watch("moneda");
  const monto = watch("monto");
  const metodoPago = watch("metodoPago");
  const cuentaBancariaId = watch("cuentaBancariaId");
  const tipoCambioUsd = watch("tipoCambioUsd");
  const embarqueId = watch("embarqueId");
  const embarqueExpediente = watch("embarqueExpediente");
  const requiereCuenta = metodoPago !== "Efectivo";

  const handleEmbarqueChange = (id: string | null, exp: string | null) => {
    setValue("embarqueId", id, { shouldValidate: true, shouldDirty: true });
    setValue("embarqueExpediente", exp, { shouldValidate: true, shouldDirty: true });
  };


  const cuentasDeMoneda = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda],
  );

  // Al abrir con proveedor fijo, sincroniza el valor del formulario.
  useEffect(() => {
    if (open && proveedorIdInicial) {
      setValue("proveedorId", proveedorIdInicial, { shouldValidate: true, shouldDirty: true });
      setProveedorNombre(proveedorNombreInicial ?? "");
    }
  }, [open, proveedorIdInicial, proveedorNombreInicial, setValue]);

  // Precarga el TC del DOF cuando la moneda deja de ser MXN.
  useEffect(() => {
    if (!open || moneda === "MXN" || !tc) return;
    const sugerido = moneda === "EUR" ? tc.eurMxn : tc.usdMxn;
    if (sugerido && !(Number(tipoCambioUsd) > 0)) {
      setValue("tipoCambioUsd", sugerido, { shouldValidate: true, shouldDirty: true });
    }
  }, [open, moneda, tc, tipoCambioUsd, setValue]);

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
    if (!o) { reset(); setProveedorNombre(proveedorNombreInicial ?? ""); }
    onOpenChange(o);
  };

  // B-061: sin handler de inválidos, la promesa de handleSubmit rechazaba
  // en silencio (pageerror con el JSON crudo de zod y cero feedback visible).
  const onInvalid = (errs: FieldErrors<RegistrarAnticipoFormValues>) => {
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
      tipoCambioUsd: values.moneda === "MXN" ? null : Number(values.tipoCambioUsd),
      metodoPago: values.metodoPago,
      cuentaBancariaId: values.cuentaBancariaId || null,
      referencia: values.referencia || undefined,
      notas: values.notas || undefined,
    });
    handleOpenChange(false);
  }, onInvalid);

  const equivalenteMxn = useMemo(() => {
    const m = Number(monto);
    if (!(m > 0)) return null;
    if (moneda === "MXN") return m;
    const t = Number(tipoCambioUsd);
    return t > 0 ? m * t : null;
  }, [monto, moneda, tipoCambioUsd]);

  const tcHint = tc
    ? tc.fuente === "DOF"
      ? `Sugerido por el DOF${tc.fecha ? ` del ${tc.fecha}` : ""}. Puedes editarlo.`
      : "Sugerido por el servicio de tipos de cambio. Puedes editarlo."
    : undefined;

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
      description="El anticipo genera el cargo en la cuenta bancaria y queda disponible para aplicarse a facturas del mismo proveedor."
      size="lg"
      footer={footer}
    >
      <RegistrarAnticipoFields
        control={control}
        register={register}
        errors={errors}
        moneda={moneda}
        requiereCuenta={requiereCuenta}
        cuentaBancariaId={cuentaBancariaId}
        cuentasDeMoneda={cuentasDeMoneda}
        proveedorNombre={proveedorNombre}
        onProveedorNombre={setProveedorNombre}
        bloquearProveedor={Boolean(proveedorIdInicial)}
        tcHint={tcHint}
        equivalenteMxn={equivalenteMxn}
        embarqueId={embarqueId ?? null}
        embarqueExpediente={embarqueExpediente ?? null}
        onEmbarqueChange={handleEmbarqueChange}
      />

    </FormDialogShell>
  );
}
