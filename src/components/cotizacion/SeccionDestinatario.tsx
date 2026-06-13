/**
 * Paso 1 — destinatario de la cotización: cliente existente o prospecto.
 * v12.1.0: subcomponentes extraídos a `seccionDestinatario/` para
 * cumplir Power of 10 (≤200 líneas).
 */
import { useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import { ProspectoSection } from "./seccionDestinatario/ProspectoSection";
import type { ProspectoMatch } from "@/features/crm/hooks";
import type { CotizacionFormValues } from "@/hooks/cotizacion";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  clientes: ClienteOption[];
}

export default function SeccionDestinatario({ clientes }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const esProspecto = watch("esProspecto");
  const clienteId = watch("clienteId");
  const prospectoModo = watch("prospectoModo");
  const oportunidadId = watch("oportunidadId");
  const leadId = watch("leadId");
  const prospectoEmpresa = watch("prospectoEmpresa");

  const tieneVinculo = Boolean(oportunidadId || leadId);

  const setProspectoMode = (modo: "vincular" | "nuevo") => {
    setValue("prospectoModo", modo, { shouldDirty: true });
    if (modo === "nuevo") {
      setValue("oportunidadId", "", { shouldDirty: true });
      setValue("leadId", "", { shouldDirty: true });
    }
  };

  const handleSelectMatch = (m: ProspectoMatch) => {
    if (m.kind === "oportunidad") {
      setValue("oportunidadId", m.id, { shouldDirty: true });
      setValue("leadId", m.leadId ?? "", { shouldDirty: true });
    } else {
      setValue("leadId", m.id, { shouldDirty: true });
      setValue("oportunidadId", "", { shouldDirty: true });
    }
    setValue("prospectoEmpresa", m.empresa, { shouldDirty: true });
    setValue("prospectoContacto", m.contacto, { shouldDirty: true });
    setValue("prospectoEmail", m.email, { shouldDirty: true });
    setValue("prospectoTelefono", m.telefono, { shouldDirty: true });
  };

  const handleDesvincular = () => {
    setValue("oportunidadId", "", { shouldDirty: true });
    setValue("leadId", "", { shouldDirty: true });
  };

  return (
    <WizardSection title="Destinatario">
      <RadioGroup
        value={esProspecto ? "prospecto" : "cliente"}
        onValueChange={(v) => setValue("esProspecto", v === "prospecto")}
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cliente" id="dest-cliente" />
          <Label htmlFor="dest-cliente" className="cursor-pointer text-sm font-medium">
            Cliente existente
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="prospecto" id="dest-prospecto" />
          <Label htmlFor="dest-prospecto" className="cursor-pointer text-sm font-medium">
            Prospecto
          </Label>
        </div>
      </RadioGroup>

      {!esProspecto ? (
        <FormField label="Cliente" required>
          <Select value={clienteId} onValueChange={(v) => setValue("clienteId", v)}>
            <SelectTrigger>
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
          modo={prospectoModo}
          onChangeModo={setProspectoMode}
          tieneVinculo={tieneVinculo}
          oportunidadId={oportunidadId}
          leadId={leadId}
          prospectoEmpresa={prospectoEmpresa}
          onSelectMatch={handleSelectMatch}
          onDesvincular={handleDesvincular}
        />
      )}
    </WizardSection>
  );
}
