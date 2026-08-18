/**
 * Datos fiscales opcionales del prospecto (Paso 1).
 * Se capturan una sola vez: al guardar viajan al lead del CRM y luego
 * precargan el alta de cliente cuando el prospecto se convierte.
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/FormField";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

type CampoFiscal =
  | "prospectoRfc"
  | "prospectoDireccion"
  | "prospectoCiudad"
  | "prospectoEntidadFederativa"
  | "prospectoCp";

const CAMPOS: { name: CampoFiscal; label: string; placeholder: string; wide?: boolean }[] = [
  { name: "prospectoRfc", label: "RFC", placeholder: "Ej. ABC010101AB1" },
  { name: "prospectoCp", label: "C.P.", placeholder: "Ej. 64000" },
  { name: "prospectoDireccion", label: "Dirección", placeholder: "Calle, número, colonia", wide: true },
  { name: "prospectoCiudad", label: "Ciudad", placeholder: "Ej. Monterrey" },
  { name: "prospectoEntidadFederativa", label: "Estado", placeholder: "Ej. Nuevo León" },
];

export function ProspectoDatosFiscales() {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const capturados = CAMPOS.filter((c) => String(watch(c.name) ?? "").trim() !== "").length;
  const [abierto, setAbierto] = useState(capturados > 0);

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto w-full justify-start gap-2 px-0 hover:bg-transparent"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-sm font-medium">Datos fiscales (opcional)</span>
        <span className="text-xs text-muted-foreground">
          {capturados > 0 ? `${capturados}/${CAMPOS.length} capturados` : "Evita recapturarlos al convertir a cliente"}
        </span>
      </Button>

      {abierto && (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.name} className={c.wide ? "md:col-span-2" : undefined}>
              <FormField label={c.label}>
                <Input
                  value={String(watch(c.name) ?? "")}
                  onChange={(e) => setValue(c.name, e.target.value, { shouldDirty: true })}
                  placeholder={c.placeholder}
                />
              </FormField>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
