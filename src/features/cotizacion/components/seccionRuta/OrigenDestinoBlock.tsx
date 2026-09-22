import { useState } from "react";
import { Input } from "@/components/ui/input";
import PortSelect from "@/features/catalogos/components/PortSelect";
import { FormField } from "@/components/shared/FormField";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import { OPTS, type Ctx } from "./overrideHelpers";
import {
  aplicarSeleccionPuerto,
  MSG_TARIFA_DESVINCULADA,
  type CampoPuerto,
} from "./rutaPuertoHandlers";

export default function OrigenDestinoBlock({
  ctx, usarPortSelect, esTerrestre, conPuntoIntermedio,
}: { ctx: Ctx; usarPortSelect: boolean; esTerrestre: boolean; conPuntoIntermedio: boolean }) {
  const { watch, setValue } = ctx;
  const [desvinculada, setDesvinculada] = useState(false);
  const tarifaId = watch("tarifaId");
  // P2: el aviso sólo vive mientras no haya tarifa. Al elegir una nueva tarifa
  // válida desaparece solo, sin quedarse pegado en pantalla.
  const avisoTarifa = desvinculada && !tarifaId;

  const seleccionar = (campo: CampoPuerto) => (valor: string, puertoId: string | null) => {
    const { tarifaDesvinculada } = aplicarSeleccionPuerto(ctx, campo, valor, puertoId);
    if (tarifaDesvinculada) setDesvinculada(true);
  };

  if (usarPortSelect) {
    return (
      <>
        <FormField label="Origen">
          <PortSelect value={watch("origen")} onValueChange={seleccionar("origen")} placeholder="Buscar puerto de origen…" />
        </FormField>
        <FormField label="Destino">
          <PortSelect value={watch("destino")} onValueChange={seleccionar("destino")} placeholder="Buscar puerto de destino…" />
        </FormField>
        {avisoTarifa && (
          <ValidationAlert
            severity="warning"
            title="Revisa la tarifa"
            message={MSG_TARIFA_DESVINCULADA}
            className="md:col-span-2"
          />
        )}
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
        <FormField label="Punto de carga/descarga" required>
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
