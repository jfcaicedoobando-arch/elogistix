/**
 * Edición de opciones de una propiedad de lista. Renombrar conserva la
 * opción anterior archivada (los valores viejos siguen cuadrando).
 */
import { useState } from "react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpcionPropiedad } from "@/features/crm/hooks/usePropiedadesCrm";
import type { PropiedadCrm } from "@/features/crm/services/propiedadesCrm";

export function OpcionesEditor({ prop }: { prop: PropiedadCrm }) {
  const accion = useOpcionPropiedad();
  const [nueva, setNueva] = useState("");
  const [verArchivadas, setVerArchivadas] = useState(false);
  const visibles = prop.opciones.filter((o) => verArchivadas || !o.archivada);
  const siguienteOrden = Math.max(0, ...prop.opciones.map((o) => o.orden)) + 1;

  const agregar = () => {
    if (!nueva.trim()) return;
    accion.mutate({ tipo: "crear", propiedadId: prop.id, etiqueta: nueva, orden: siguienteOrden },
      { onSuccess: () => setNueva("") });
  };

  return (
    <div className="space-y-2 pl-4 border-l">
      {visibles.map((o) => (
        <div key={`${o.id}-${o.etiqueta}`} className="flex items-center gap-2">
          <Input
            defaultValue={o.etiqueta} disabled={o.archivada || accion.isPending} className="h-8 max-w-xs"
            aria-label={`Nombre de la opción ${o.etiqueta}`}
            onBlur={(e) => accion.mutate({ tipo: "renombrar", propiedadId: prop.id, opcion: o, etiqueta: e.target.value })}
          />
          {o.archivada && <span className="text-label text-muted-foreground">Archivada</span>}
          <Button
            size="icon" variant="ghost" className="h-8 w-8" disabled={accion.isPending}
            aria-label={o.archivada ? `Restaurar ${o.etiqueta}` : `Archivar ${o.etiqueta}`}
            onClick={() => accion.mutate({ tipo: "archivar", id: o.id, archivada: !o.archivada })}
          >
            {o.archivada ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva opción"
          className="h-8 max-w-xs" maxLength={120}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
        />
        <Button size="sm" variant="outline" onClick={agregar} disabled={!nueva.trim() || accion.isPending}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
        <Button size="sm" variant="link" onClick={() => setVerArchivadas((v) => !v)}>
          {verArchivadas ? "Ocultar archivadas" : "Ver archivadas"}
        </Button>
      </div>
    </div>
  );
}
