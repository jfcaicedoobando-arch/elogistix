import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import { MODOS, TIPOS, INCOTERMS } from "@/constants/wizardConstants";
import {
  MODALIDADES_EQUIPO_TERRESTRE,
  TIPOS_OPERACION_TERRESTRE,
} from "@/constants/cotizacionTerrestre";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

export default function SeccionDatosGeneralesCotizacion({ complete }: { complete?: boolean } = {}) {
  const { watch, setValue, formState: { errors }, clearErrors } = useFormContext<CotizacionFormValues>();
  const modo = watch("modo");
  const tipo = watch("tipo");
  const esTerrestre = modo === "Terrestre";

  // Mantener consistencia al cambiar modo: terrestre fuerza tipo válido + incoterm N/A.
  useEffect(() => {
    if (!esTerrestre) return;
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    if (!TIPOS_OPERACION_TERRESTRE.includes(tipo as typeof TIPOS_OPERACION_TERRESTRE[number])) {
      setValue("tipo", "Nacional", opts);
    }
    if (watch("incoterm") !== "N/A") {
      setValue("incoterm", "N/A", opts);
    }
    if (watch("tipoMovimiento")) {
      setValue("tipoMovimiento", "", opts);
    }
  }, [esTerrestre, tipo, setValue, watch]);

  const tiposDisponibles = esTerrestre
    ? (TIPOS_OPERACION_TERRESTRE as readonly string[])
    : (TIPOS as readonly string[]);

  // Layout: 3 columnas estándar; en terrestre quitamos Incoterm y agregamos Modalidad.
  return (
    <WizardSection title="Datos generales" columns={3} complete={complete}>
      <FormField label="Modo de transporte" required error={errors.modo?.message}>
        <Select value={modo} onValueChange={v => { setValue("modo", v, { shouldValidate: true, shouldDirty: true }); clearErrors("modo"); }}>
          <SelectTrigger aria-invalid={!!errors.modo}><SelectValue /></SelectTrigger>
          <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </FormField>
      <FormField label="Tipo de operación" required error={errors.tipo?.message}>
        <Select value={tipo} onValueChange={v => { setValue("tipo", v, { shouldValidate: true, shouldDirty: true }); clearErrors("tipo"); }}>
          <SelectTrigger aria-invalid={!!errors.tipo}><SelectValue /></SelectTrigger>
          <SelectContent>
            {tiposDisponibles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormField>

      {esTerrestre ? (
        <FormField label="Modalidad de equipo" required error={errors.modalidadEquipo?.message}>
          <Select
            value={watch("modalidadEquipo")}
            onValueChange={v => {
              setValue("modalidadEquipo", v, { shouldValidate: true, shouldDirty: true });
              clearErrors("modalidadEquipo");
            }}
          >
            <SelectTrigger aria-invalid={!!errors.modalidadEquipo}><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
            <SelectContent>
              {MODALIDADES_EQUIPO_TERRESTRE.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : (
        <FormField label="Incoterm" required error={errors.incoterm?.message}>
          <Select value={watch("incoterm")} onValueChange={v => { setValue("incoterm", v); clearErrors("incoterm"); }}>
            <SelectTrigger aria-invalid={!!errors.incoterm}><SelectValue /></SelectTrigger>
            <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      )}
    </WizardSection>
  );
}
