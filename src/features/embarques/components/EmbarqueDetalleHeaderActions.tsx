import { useNavigate } from "react-router-dom";
import { Edit, Trash2, Share2, Copy, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvanzarEstadoButton } from "./header/AvanzarEstadoButton";
import { ReabrirEmbarqueButton } from "./header/ReabrirEmbarqueButton";

interface Props {
  expediente: string;
  estadoVisual: string;
  siguienteEstado: string | null;
  canEdit: boolean;
  avanzandoEstado: boolean;
  trackingPending: boolean;
  embarqueId: string;
  puedeReabrir: boolean;
  reabriendoEstado: boolean;
  docsFaltantes: string[];
  bloqueadoPorDocs: boolean;
  onAvanzarEstado: () => void;
  onCompartirTracking: () => void;
  onAbrirEliminar: () => void;
  onAbrirDuplicar: () => void;
  onReabrir: () => void;
  // v13.89.1 — Cierre gateado
  cierreEsSiguiente: boolean;
  rolPuedeCerrar: boolean;
  cierrePuedeAvanzar: boolean;
  cierreMotivoBloqueo: "rol" | "checklist" | null;
  onIrACierre: () => void;
  onIrADocumentos: () => void;
}

export function EmbarqueDetalleHeaderActions({
  expediente, estadoVisual, siguienteEstado, canEdit, avanzandoEstado, trackingPending,
  embarqueId, puedeReabrir, reabriendoEstado, docsFaltantes, bloqueadoPorDocs,
  onAvanzarEstado, onCompartirTracking, onAbrirEliminar, onAbrirDuplicar, onReabrir,
  cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo, onIrACierre, onIrADocumentos,
}: Props) {
  // B-058 (v13.320.39): en estados terminales/cerrados el borrado ya no aplica.
  const esTerminal = ["Entregado", "EIR", "Cerrado", "Cancelado"].includes(estadoVisual);
  const navigate = useNavigate();
  const goEditar = () => navigate(`/embarques/${embarqueId}/editar`);

  const ocultarAvance = cierreEsSiguiente && !rolPuedeCerrar;
  const cierreBloqueadoPorChecklist =
    cierreEsSiguiente && rolPuedeCerrar && !cierrePuedeAvanzar && cierreMotivoBloqueo === "checklist";

  const accionPrincipal = renderAccionPrincipal({
    canEdit, siguienteEstado, ocultarAvance, estadoVisual, avanzandoEstado,
    bloqueadoPorDocs, docsFaltantes, cierreBloqueadoPorChecklist,
    onAvanzarEstado, onIrACierre, onIrADocumentos, goEditar,
  });

  return (
    <div className="flex gap-1.5 flex-wrap lg:flex-nowrap lg:justify-end items-center">
      {accionPrincipal}
      {canEdit && siguienteEstado && (
        <Button variant="outline" size="sm" onClick={goEditar}>
          <Edit className="h-4 w-4 mr-1" /> Editar
        </Button>
      )}

      {puedeReabrir && (
        <ReabrirEmbarqueButton
          expediente={expediente}
          reabriendoEstado={reabriendoEstado}
          onReabrir={onReabrir}
        />
      )}

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Más acciones" className="h-9 w-9 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onCompartirTracking();
              }}
              disabled={trackingPending}
            >
              <Share2 className="h-4 w-4 mr-2" /> Compartir tracking
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onAbrirDuplicar();
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicar embarque
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onAbrirEliminar();
              }}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface AccionPrincipalArgs {
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

function renderAccionPrincipal(a: AccionPrincipalArgs) {
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
