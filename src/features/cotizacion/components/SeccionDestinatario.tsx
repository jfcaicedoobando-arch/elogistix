/**
 * Paso 1 — destinatario de la cotización: cliente existente o prospecto.
 * v12.1.0: subcomponentes extraídos a `seccionDestinatario/` para
 * cumplir Power of 10 (≤200 líneas).
 *
 * P0 (cotizaciones huérfanas): el prospecto SIEMPRE se vincula a un lead u
 * oportunidad existente del CRM; el modo "crear nuevo prospecto" se retiró.
 * Un vínculo ya persistido (edición) no puede sustituirse aquí.
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import { ProspectoSection } from "./seccionDestinatario/ProspectoSection";
import type { ProspectoMatch } from "@/features/crm/hooks";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import { useOportunidad } from "@/features/crm/hooks";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteOption[];
  complete?: boolean;
  /**
   * Vínculo CRM ya confirmado (edición o primer vínculo exitoso): el
   * destinatario/origen queda inmutable, aunque el resto del paso 1 sí se edita.
   */
  vinculoConfirmado?: boolean;
  /** Limpia el aviso de vínculo pendiente al cambiar de prospecto a cliente. */
  onLimpiarVinculoError?: () => void;
}

export default function SeccionDestinatario({ clientes, complete, vinculoConfirmado = false, onLimpiarVinculoError }: Props) {
  const { watch, setValue, formState: { errors }, clearErrors } = useFormContext<CotizacionFormValues>();
  const esProspecto = watch("esProspecto");
  const clienteId = watch("clienteId");
  const oportunidadId = watch("oportunidadId");
  const leadId = watch("leadId");
  const prospectoEmpresa = watch("prospectoEmpresa");

  const tieneVinculo = Boolean(oportunidadId || leadId);
  // Bug 1: la moneda de la oportunidad se muestra en cuanto se vincula, para
  // capturar los importes en la moneda que el CRM ya tiene registrada.
  const [monedaOportunidad, setMonedaOportunidad] = useState<string | null>(
    () => watch("monedaCrm") || null,
  );
  // A1/A7: al reabrir se lee la divisa REAL de la oportunidad (otra entidad),
  // no la persistida en la cotización. Si difieren se muestra la discrepancia
  // y se preservan los datos: aquí no se convierte ni se corrige nada.
  const { data: oportunidad } = useOportunidad(oportunidadId || undefined);
  const monedaReal = oportunidad?.moneda ?? null;
  const monedaMostrada = monedaReal ?? monedaOportunidad;
  const monedaDiscrepante = Boolean(
    monedaReal && monedaOportunidad && monedaReal !== monedaOportunidad,
  );

  /** A1/A7: la moneda del CRM viaja en el form para que el guardado la use. */
  const aplicarMonedaCrm = (moneda: string | null) => {
    setMonedaOportunidad(moneda);
    const valida = moneda === "USD" || moneda === "MXN" ? moneda : "";
    setValue("monedaCrm", valida, { shouldDirty: true });
  };

  const handleSelectMatch = (m: ProspectoMatch) => {
    if (m.kind === "oportunidad") {
      setValue("oportunidadId", m.id, { shouldDirty: true, shouldValidate: true });
      setValue("leadId", m.leadId ?? "", { shouldDirty: true });
    } else {
      setValue("leadId", m.id, { shouldDirty: true, shouldValidate: true });
      setValue("oportunidadId", "", { shouldDirty: true });
    }
    setValue("prospectoEmpresa", m.empresa, { shouldDirty: true });
    setValue("prospectoContacto", m.contacto, { shouldDirty: true });
    setValue("prospectoEmail", m.email, { shouldDirty: true });
    setValue("prospectoTelefono", m.telefono, { shouldDirty: true });
    clearErrors(["oportunidadId", "leadId", "prospectoEmpresa"]);
    aplicarMonedaCrm(m.kind === "oportunidad" ? (m.moneda ?? null) : null);
  };

  const handleDesvincular = () => {
    if (vinculoConfirmado) return;
    setValue("oportunidadId", "", { shouldDirty: true });
    setValue("leadId", "", { shouldDirty: true });
    // Bug 2: al desvincular, el aviso de validación anterior ya no aplica.
    clearErrors(["oportunidadId", "leadId", "prospectoEmpresa"]);
    onLimpiarVinculoError?.();
    aplicarMonedaCrm(null);
  };

  const handleCambioDestinatario = (v: string) => {
    if (vinculoConfirmado) return;
    setValue("esProspecto", v === "prospecto");
    // Si aún no hay vínculo confirmado y el usuario vuelve a "cliente", el
    // aviso de vínculo pendiente ya no aplica.
    if (v !== "prospecto") onLimpiarVinculoError?.();
  };


  return (
    <WizardSection title="Destinatario" complete={complete}>
      <RadioGroup
        value={esProspecto ? "prospecto" : "cliente"}
        onValueChange={handleCambioDestinatario}
        disabled={vinculoConfirmado}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cliente" id="dest-cliente" disabled={vinculoConfirmado} />
          <Label htmlFor="dest-cliente" className="cursor-pointer text-body font-medium">
            Cliente existente
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="prospecto" id="dest-prospecto" disabled={vinculoConfirmado} />
          <Label htmlFor="dest-prospecto" className="cursor-pointer text-body font-medium">
            Prospecto
          </Label>
        </div>
      </RadioGroup>

      {!esProspecto ? (
        <FormField label="Cliente" required error={errors.clienteId?.message}>
          <Select
            value={clienteId}
            disabled={vinculoConfirmado}
            onValueChange={(v) => {
              setValue("clienteId", v, { shouldValidate: true, shouldDirty: true });
              clearErrors("clienteId");
            }}
          >
            <SelectTrigger aria-invalid={!!errors.clienteId}>

              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : (
        <ProspectoSection
          tieneVinculo={tieneVinculo}
          vinculoConfirmado={vinculoConfirmado}
          oportunidadId={oportunidadId}
          leadId={leadId}
          prospectoEmpresa={prospectoEmpresa}
          onSelectMatch={handleSelectMatch}
          onDesvincular={handleDesvincular}
          monedaOportunidad={monedaMostrada}
          monedaCotizacion={monedaOportunidad}
          monedaDiscrepante={monedaDiscrepante}
        />
      )}
      {esProspecto && (errors.oportunidadId?.message || errors.leadId?.message) && (
        <p className="text-body-sm text-destructive">
          {errors.oportunidadId?.message ?? errors.leadId?.message}
        </p>
      )}
    </WizardSection>
  );
}
