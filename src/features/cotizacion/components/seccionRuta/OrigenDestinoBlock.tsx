import { Input } from "@/components/ui/input";
import PortSelect from "@/features/catalogos/components/PortSelect";
import { FormField } from "@/components/shared/FormField";
import { OPTS, type Ctx } from "./overrideHelpers";

export default function OrigenDestinoBlock({
  ctx, usarPortSelect, esTerrestre, conPuntoIntermedio,
}: { ctx: Ctx; usarPortSelect: boolean; esTerrestre: boolean; conPuntoIntermedio: boolean }) {
  const { watch, setValue } = ctx;
  if (usarPortSelect) {
    return (
      <>
        <FormField label="Origen">
          <PortSelect value={watch("origen")} onValueChange={v => setValue("origen", v)} placeholder="Buscar puerto de origen..." />
        </FormField>
        <FormField label="Destino">
          <PortSelect value={watch("destino")} onValueChange={v => setValue("destino", v)} placeholder="Buscar puerto de destino..." />
        </FormField>
      </>
    );
  }
  const placeholderOrigen = esTerrestre ? "Ej. CDMX" : "Ej. Shanghai, China";
  const placeholderDestino = esTerrestre ? "Ej. Monterrey" : "Ej. Manzanillo, México";
  return (
    <>
      <FormField label="Origen">
        <Input value={watch("origen")} onChange={e => setValue("origen", e.target.value)} placeholder={placeholderOrigen} />
      </FormField>
      {conPuntoIntermedio && (
        <FormField label="Punto de carga/descarga">
          <Input
            value={watch("puntoIntermedio")}
            onChange={e => setValue("puntoIntermedio", e.target.value, OPTS)}
            placeholder="Ej. Terminal Pantaco"
          />
        </FormField>
      )}
      <FormField label="Destino">
        <Input value={watch("destino")} onChange={e => setValue("destino", e.target.value)} placeholder={placeholderDestino} />
      </FormField>
    </>
  );
}
