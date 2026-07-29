import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvanzarEstadoButton } from "./AvanzarEstadoButton";

export interface AccionPrincipalArgs {
  canEdit: boolean;
  siguienteEstado: string | null;
  ocultarAvance: boolean;
  estadoVisual: string;
  avanzandoEstado: boolean;
  bloqueadoPorDocs: boolean;
  docsFaltantes: string[];
  cierreBloqueadoPorChecklist: boolean;
  onAvanzarEstado: () => void;
  onIrACierre: () => void;
  onIrADocumentos: () => void;
  goEditar: () => void;
}

/**
 * Acción principal del header de detalle de embarque: avanzar de estado
 * cuando aplica, o editar como fallback.
 */
export function AccionPrincipalEmbarque(a: AccionPrincipalArgs) {
  if (!a.canEdit) return null;
  if (a.siguienteEstado && !a.ocultarAvance) {
    return (
      <AvanzarEstadoButton
        estadoVisual={a.estadoVisual}
        siguienteEstado={a.siguienteEstado}
        avanzandoEstado={a.avanzandoEstado}
        bloqueadoPorDocs={a.bloqueadoPorDocs}
        docsFaltantes={a.docsFaltantes}
        cierreBloqueadoPorChecklist={a.cierreBloqueadoPorChecklist}
        onAvanzarEstado={a.onAvanzarEstado}
        onIrACierre={a.onIrACierre}
        onIrADocumentos={a.onIrADocumentos}
      />
    );
  }
  return (
    <Button size="sm" onClick={a.goEditar}>
      <Edit className="h-4 w-4 mr-1" /> Editar
    </Button>
  );
}
