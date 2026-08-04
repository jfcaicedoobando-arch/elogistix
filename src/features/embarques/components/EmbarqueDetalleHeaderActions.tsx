import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, Trash2, Share2, Copy, MoreHorizontal, Ban, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccionPrincipalEmbarque } from "./header/AccionPrincipalEmbarque";
import { ReabrirEmbarqueButton } from "./header/ReabrirEmbarqueButton";
import { CancelarEmbarqueDialog } from "./header/CancelarEmbarqueDialog";
import { usePermissions } from "@/hooks/shared/usePermissions";

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
  onReabrir: (motivo: string) => void;
  // v13.89.1 — Cierre gateado
  cierreEsSiguiente: boolean;
  rolPuedeCerrar: boolean;
  cierrePuedeAvanzar: boolean;
  cierreMotivoBloqueo: "rol" | "checklist" | null;
  onIrACierre: () => void;
  onIrADocumentos: () => void;
  // B-058: cancelar y bloqueo de eliminar por deuda pendiente.
  onCancelar: (motivo: string) => Promise<void> | void;
  cancelandoEmbarque: boolean;
  tieneDeudaPendiente: boolean;
}

const ESTADOS_TERMINALES = ["Entregado", "EIR", "Por liquidar", "Cerrado", "Cancelado"];
const ESTADOS_CANCELABLES = ["Borrador", "Confirmado", "En Tránsito", "Llegada", "En Aduana", "Arribo"];

/** Lint (complejidad): derivaciones de estado fuera del componente. */
function derivarEstadoAcciones(estadoVisual: string) {
  return {
    esTerminal: ESTADOS_TERMINALES.includes(estadoVisual),
    puedeCancelar: ESTADOS_CANCELABLES.includes(estadoVisual),
  };
}

/** Lint (complejidad): menú "Más acciones" extraído del componente raíz. */
function MenuMasAcciones(props: {
  trackingPending: boolean;
  puedeCancelar: boolean;
  puedeEliminar: boolean;
  esTerminal: boolean;
  canEliminarEmbarque: boolean;
  onCompartirTracking: () => void;
  onAbrirDuplicar: () => void;
  onAbrirEliminar: () => void;
  onPedirCancelar: () => void;
}) {
  const {
    trackingPending, puedeCancelar, puedeEliminar, esTerminal, canEliminarEmbarque,
    onCompartirTracking, onAbrirDuplicar, onAbrirEliminar, onPedirCancelar,
  } = props;
  return (
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
            {puedeCancelar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onPedirCancelar();
                  }}
                  className="text-warning focus:text-warning focus:bg-warning/10"
                >
                  <Ban className="h-4 w-4 mr-2" /> Cancelar embarque
                </DropdownMenuItem>
              </>
            )}
            {puedeEliminar && (
              <>
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
              </>
            )}
            {!esTerminal && !puedeEliminar && canEliminarEmbarque && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                Eliminar deshabilitado: hay CxC/CxP pendientes.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
  );
}

export function EmbarqueDetalleHeaderActions({
  expediente, estadoVisual, siguienteEstado, canEdit, avanzandoEstado, trackingPending,
  embarqueId, puedeReabrir, reabriendoEstado, docsFaltantes, bloqueadoPorDocs,
  onAvanzarEstado, onCompartirTracking, onAbrirEliminar, onAbrirDuplicar, onReabrir,
  cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo, onIrACierre, onIrADocumentos,
  onCancelar, cancelandoEmbarque, tieneDeudaPendiente,
}: Props) {
  // B-058 (v13.320.39): en estados terminales/cerrados el borrado ya no aplica.
  const { esTerminal, puedeCancelar } = derivarEstadoAcciones(estadoVisual);
  // FIX C1 (S5-01): el borrado exige rol admin/operador, igual que el guard del RPC.
  const { canEliminarEmbarque } = usePermissions();
  const puedeEliminar = !esTerminal && !tieneDeudaPendiente && canEliminarEmbarque;
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const navigate = useNavigate();
  const goEditar = () => navigate(`/embarques/${embarqueId}/editar`);

  const ocultarAvance = cierreEsSiguiente && !rolPuedeCerrar;
  const cierreBloqueadoPorChecklist =
    cierreEsSiguiente && rolPuedeCerrar && !cierrePuedeAvanzar && cierreMotivoBloqueo === "checklist";

  const accionPrincipal = AccionPrincipalEmbarque({
    canEdit, siguienteEstado, ocultarAvance, estadoVisual, avanzandoEstado,
    bloqueadoPorDocs, docsFaltantes, cierreBloqueadoPorChecklist,
    onAvanzarEstado, onIrACierre, onIrADocumentos, goEditar,
  });

  return (
    <div className="flex gap-1.5 flex-wrap lg:flex-nowrap lg:justify-end items-center">
      {accionPrincipal}
      {canEdit && siguienteEstado && !ocultarAvance && (
        <Button variant="outline" size="sm" onClick={goEditar}>
          <Edit className="h-4 w-4 mr-1" /> Editar
        </Button>
      )}
      {canEdit && ocultarAvance && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-muted-foreground cursor-default">
              <Lock className="h-3 w-3" /> Cierre restringido
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Requiere finanzas o admin para cerrar el embarque</TooltipContent>
        </Tooltip>
      )}

      {puedeReabrir && (
        <ReabrirEmbarqueButton
          expediente={expediente}
          reabriendoEstado={reabriendoEstado}
          onReabrir={onReabrir}
        />
      )}

      {canEdit && (
        <MenuMasAcciones
          trackingPending={trackingPending}
          puedeCancelar={puedeCancelar}
          puedeEliminar={puedeEliminar}
          esTerminal={esTerminal}
          canEliminarEmbarque={canEliminarEmbarque}
          onCompartirTracking={onCompartirTracking}
          onAbrirDuplicar={onAbrirDuplicar}
          onAbrirEliminar={onAbrirEliminar}
          onPedirCancelar={() => setCancelarOpen(true)}
        />
      )}
      <CancelarEmbarqueDialog
        open={cancelarOpen}
        onOpenChange={setCancelarOpen}
        expediente={expediente}
        isPending={cancelandoEmbarque}
        onConfirm={onCancelar}
      />
    </div>
  );
}

