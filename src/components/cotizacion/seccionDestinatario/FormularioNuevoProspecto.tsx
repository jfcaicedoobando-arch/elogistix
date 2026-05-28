/**
 * Formulario inline para crear un nuevo prospecto desde la cotización.
 */
import { useFormContext } from "react-hook-form";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import type { CotizacionFormValues } from "@/hooks/cotizacion";

export function FormularioNuevoProspecto() {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-xs">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          Al guardar la cotización se creará automáticamente un <strong>lead</strong> y
          una <strong>oportunidad</strong> en el CRM (etapa "Cotizando").
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Nombre de Empresa" required>
          <Input
            value={watch("prospectoEmpresa")}
            onChange={(e) => setValue("prospectoEmpresa", e.target.value)}
            placeholder="Ej. Importaciones ABC"
          />
        </FormField>
        <FormField label="Nombre de Contacto" required>
          <Input
            value={watch("prospectoContacto")}
            onChange={(e) => setValue("prospectoContacto", e.target.value)}
            placeholder="Ej. Juan Pérez"
          />
        </FormField>
        <FormField label="Email">
          <Input
            type="email"
            value={watch("prospectoEmail")}
            onChange={(e) => setValue("prospectoEmail", e.target.value)}
            placeholder="contacto@empresa.com"
          />
        </FormField>
        <FormField label="Teléfono">
          <Input
            value={watch("prospectoTelefono")}
            onChange={(e) => setValue("prospectoTelefono", e.target.value)}
            placeholder="+52 55 1234 5678"
          />
        </FormField>
      </div>
    </div>
  );
}
