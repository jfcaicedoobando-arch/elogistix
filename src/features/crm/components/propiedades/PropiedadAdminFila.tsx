/**
 * Fila de administración de una propiedad: nombre, obligatoria, orden,
 * archivar y (si es lista) sus opciones.
 */
import { Archive, ArchiveRestore, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useActualizarPropiedad } from "@/features/crm/hooks/usePropiedadesCrm";
import type { PropiedadCrm, TipoPropiedad } from "@/features/crm/services/propiedadesCrm";
import { OpcionesEditor } from "./OpcionesEditor";

export const ETIQUETA_TIPO: Record<TipoPropiedad, string> = {
  seleccion: "Lista (una opción)", multiseleccion: "Lista (varias opciones)",
  numero: "Número", fecha: "Fecha", texto: "Texto libre",
};

interface Props {
  prop: PropiedadCrm;
  /** Propiedades vecinas para intercambiar el orden. */
  anterior?: PropiedadCrm;
  siguiente?: PropiedadCrm;
}

export function PropiedadAdminFila({ prop, anterior, siguiente }: Props) {
  const actualizar = useActualizarPropiedad();
  const ocupado = actualizar.isPending;
  const intercambiar = (otra: PropiedadCrm) => {
    actualizar.mutate({ id: prop.id, cambio: { orden: otra.orden } });
    actualizar.mutate({ id: otra.id, cambio: { orden: prop.orden } });
  };
  const esLista = prop.tipo === "seleccion" || prop.tipo === "multiseleccion";

  return (
    <div className="rounded-md border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          key={prop.etiqueta} defaultValue={prop.etiqueta} className="h-8 max-w-sm" disabled={prop.archivada || ocupado}
          aria-label={`Nombre de la propiedad ${prop.etiqueta}`}
          onBlur={(e) => { if (e.target.value.trim() !== prop.etiqueta) actualizar.mutate({ id: prop.id, cambio: { etiqueta: e.target.value.trim() } }); }}
        />
        <Badge variant="outline">{ETIQUETA_TIPO[prop.tipo]}</Badge>
        {prop.archivada && <Badge variant="secondary">Archivada</Badge>}
        <label className="flex items-center gap-2 text-body-sm">
          <Switch checked={prop.obligatoria} disabled={prop.archivada || ocupado}
            onCheckedChange={(c) => actualizar.mutate({ id: prop.id, cambio: { obligatoria: c } })} />
          Obligatoria
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={!anterior || ocupado}
            onClick={() => anterior && intercambiar(anterior)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar" disabled={!siguiente || ocupado}
            onClick={() => siguiente && intercambiar(siguiente)}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" disabled={ocupado}
            onClick={() => actualizar.mutate({ id: prop.id, cambio: { archivada: !prop.archivada } })}>
            {prop.archivada ? <><ArchiveRestore className="h-4 w-4" /> Restaurar</> : <><Archive className="h-4 w-4" /> Archivar</>}
          </Button>
        </div>
      </div>
      {esLista && !prop.archivada && <OpcionesEditor prop={prop} />}
    </div>
  );
}
