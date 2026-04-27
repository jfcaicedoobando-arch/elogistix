import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import type { CotizacionFormValues } from "@/hooks/cotizacion/wizard/useCotizacionWizardForm";

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
          <Select value={clienteId} onValueChange={v => setValue("clienteId", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
            <SelectContent>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre de Empresa" required>
            <Input value={watch("prospectoEmpresa")} onChange={e => setValue("prospectoEmpresa", e.target.value)} placeholder="Ej. Importaciones ABC" />
          </FormField>
          <FormField label="Nombre de Contacto" required>
            <Input value={watch("prospectoContacto")} onChange={e => setValue("prospectoContacto", e.target.value)} placeholder="Ej. Juan Pérez" />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={watch("prospectoEmail")} onChange={e => setValue("prospectoEmail", e.target.value)} placeholder="contacto@empresa.com" />
          </FormField>
          <FormField label="Teléfono">
            <Input value={watch("prospectoTelefono")} onChange={e => setValue("prospectoTelefono", e.target.value)} placeholder="+52 55 1234 5678" />
          </FormField>
        </div>
      )}
    </WizardSection>
  );
}
