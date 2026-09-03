/**
 * Paso 1 — destinatario de la cotización: cliente existente o prospecto.
 * v12.1.0: subcomponentes extraídos a `seccionDestinatario/` para
 * cumplir Power of 10 (≤200 líneas).
 *
 * P0 (cotizaciones huérfanas): el prospecto SIEMPRE se vincula a un lead u
 * oportunidad existente del CRM; el modo "crear nuevo prospecto" se retiró.
 * Un vínculo ya persistido (edición) no puede sustituirse aquí.
 */
import { useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import { ProspectoSection } from "./seccionDestinatario/ProspectoSection";
import type { ProspectoMatch } from "@/features/crm/hooks";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteOption[];
  complete?: boolean;
}

export default function SeccionDestinatario({ clientes, complete }: Props) {
  const { watch, setValue, getValues, formState: { errors }, clearErrors } = useFormContext<CotizacionFormValues>();
  const esProspecto = watch("esProspecto");
  const clienteId = watch("clienteId");
  const oportunidadId = watch("oportunidadId");
  const leadId = watch("leadId");
  const prospectoEmpresa = watch("prospectoEmpresa");

  const tieneVinculo = Boolean(oportunidadId || leadId);
  // Un vínculo que ya venía guardado (edición) es inmutable en el cotizador.
  const vinculoConfirmado = useRef(Boolean(getValues("oportunidadId"))).current;

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
  };

  const handleDesvincular = () => {
    if (vinculoConfirmado) return;
    setValue("oportunidadId", "", { shouldDirty: true });
    setValue("leadId", "", { shouldDirty: true });
  };

  return (
    <WizardSection title="Destinatario" complete={complete}>
      <RadioGroup
        value={esProspecto ? "prospecto" : "cliente"}
        onValueChange={(v) => setValue("esProspecto", v === "prospecto")}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cliente" id="dest-cliente" />
          <Label htmlFor="dest-cliente" className="cursor-pointer text-body font-medium">
            Cliente existente
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="prospecto" id="dest-prospecto" />
          <Label htmlFor="dest-prospecto" className="cursor-pointer text-body font-medium">
            Prospecto
          </Label>
        </div>
      </RadioGroup>

      {!esProspecto ? (
        <FormField label="Cliente" required error={errors.clienteId?.message}>
          <Select
            value={clienteId}
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
