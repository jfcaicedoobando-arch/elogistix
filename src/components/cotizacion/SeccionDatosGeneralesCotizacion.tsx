import { useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import { MODOS, TIPOS, INCOTERMS } from "@/constants/wizardConstants";
import type { CotizacionFormValues } from "@/hooks/cotizacion/wizard/useCotizacionWizardForm";

export default function SeccionDatosGeneralesCotizacion() {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();

  return (
    <WizardSection title="Datos Generales" columns={3}>
      <FormField label="Modo de Transporte" required>
        <Select value={watch("modo")} onValueChange={v => setValue("modo", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <FormField label="Tipo de Operación" required>
        <Select value={watch("tipo")} onValueChange={v => setValue("tipo", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <FormField label="Incoterm" required>
        <Select value={watch("incoterm")} onValueChange={v => setValue("incoterm", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
    </WizardSection>
  );
}
