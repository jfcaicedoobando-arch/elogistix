/** Dialog "Registrar anticipo" (QW6). FormDialogShell + RHF + Zod. */
import { useCallback, useMemo, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifyError } from "@/lib/ui/appFeedback";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useRegistrarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { useRegistrarAnticipoDefaults } from "@/features/anticipos-proveedor/hooks/useRegistrarAnticipoDefaults";
import { equivalenteMxnAnticipo } from "@/features/anticipos-proveedor/domain/registrarAnticipoPolicy";
import { todayLocalISO } from "@/lib/date/today";
import { RegistrarAnticipoFields } from "./RegistrarAnticipoFields";
import { usePayloadRequestId, scopeDePayload } from "@/lib/idempotency";
import { registrarAnticipoSchema, type RegistrarAnticipoFormInput, type RegistrarAnticipoFormValues } from "./registrarAnticipo.schema";

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
  // Ola 2 · O2.5 — misma llave mientras se reintenta el MISMO payload: el
  // servidor deduplica el anticipo y su cargo bancario en vez de crearlos dos
  // veces. MNY: si el usuario cambia proveedor, monto, moneda, fecha, cuenta,
  // método, referencia o notas, la llave se rota para que el backend no
  // reproduzca el anticipo anterior como éxito falso.
  const requestId = usePayloadRequestId();
  const [proveedorNombre, setProveedorNombre] = useState(proveedorNombreInicial ?? "");

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<RegistrarAnticipoFormInput, unknown, RegistrarAnticipoFormValues>({
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
  const fechaAnticipo = watch("fechaAnticipo");
  const monto = watch("monto");
  const metodoPago = watch("metodoPago");
  const cuentaBancariaId = watch("cuentaBancariaId");
  const tipoCambioUsd = watch("tipoCambioUsd");
  // El input HTML entrega texto, mientras que el tipo de cambio sugerido se
  // guarda como número. Normalizamos ambos para no reemplazar una captura manual.
  const tipoCambioNumerico = tipoCambioUsd === "" || tipoCambioUsd == null
    ? undefined
    : Number(tipoCambioUsd);
  const embarqueId = watch("embarqueId");
  const embarqueExpediente = watch("embarqueExpediente");
  const requiereCuenta = metodoPago !== "Efectivo";

  const handleEmbarqueChange = (id: string | null, exp: string | null) => {
    setValue("embarqueId", id, { shouldValidate: true, shouldDirty: true });
    setValue("embarqueExpediente", exp, { shouldValidate: true, shouldDirty: true });
  };

  const onProveedorFijo = useCallback(
    () => setProveedorNombre(proveedorNombreInicial ?? ""),
    [proveedorNombreInicial],
  );

  const { cuentasDeMoneda = [], tcHint } = useRegistrarAnticipoDefaults({
    open,
    moneda,
    fechaAnticipo,
    cuentaBancariaId,
    requiereCuenta,
    tipoCambioUsd: Number.isFinite(tipoCambioNumerico) ? tipoCambioNumerico : undefined,
    proveedorIdInicial,
    setValue,
    onProveedorFijo,
  });

  const handleOpenChange = (o: boolean) => {
    if (!o) { reset(); setProveedorNombre(proveedorNombreInicial ?? ""); }
    onOpenChange(o);
  };

  // B-061: sin handler de inválidos, la promesa de handleSubmit rechazaba
  // en silencio (pageerror con el JSON crudo de zod y cero feedback visible).
  const onInvalid = (errs: FieldErrors<RegistrarAnticipoFormInput>) => {
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
      // MNY P1.1: Efectivo no genera salida bancaria; jamás se manda cuenta.
      cuentaBancariaId: requiereCuenta ? values.cuentaBancariaId || null : null,
      referencia: values.referencia || undefined,
      notas: values.notas || undefined,
      embarqueId: values.embarqueId ?? null,
      requestId: requestId.get(
        scopeDePayload([
          values.proveedorId,
          values.monto,
          values.moneda,
          values.fechaAnticipo,
          values.moneda === "MXN" ? null : Number(values.tipoCambioUsd),
          values.metodoPago,
          requiereCuenta ? values.cuentaBancariaId || null : null,
          values.referencia ?? "",
          values.notas ?? "",
          values.embarqueId ?? null,
        ]),
      ),
    });
    requestId.reset();
    handleOpenChange(false);
  }, onInvalid);

  const equivalenteMxn = useMemo(
    () => equivalenteMxnAnticipo(Number(monto), moneda, tipoCambioNumerico),
    [monto, moneda, tipoCambioNumerico],
  );

  const footer = (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={registrar.isPending}>Cancelar</Button>
      <Button onClick={onSubmit} loading={registrar.isPending}>
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
      description={
        requiereCuenta
          ? "El anticipo genera el cargo en la cuenta bancaria y queda disponible para aplicarse a facturas del mismo proveedor."
          : "El anticipo pagado en efectivo no genera movimiento bancario y queda disponible para aplicarse a facturas del mismo proveedor."
      }
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
