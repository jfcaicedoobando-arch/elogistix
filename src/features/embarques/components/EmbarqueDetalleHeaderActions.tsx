import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, Trash2, Share2, Copy, MoreHorizontal, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function EmbarqueDetalleHeaderActions({
  expediente, estadoVisual, siguienteEstado, canEdit, avanzandoEstado, trackingPending,
  embarqueId, puedeReabrir, reabriendoEstado, docsFaltantes, bloqueadoPorDocs,
  onAvanzarEstado, onCompartirTracking, onAbrirEliminar, onAbrirDuplicar, onReabrir,
  cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo, onIrACierre, onIrADocumentos,
  onCancelar, cancelandoEmbarque, tieneDeudaPendiente,
}: Props) {
  // B-058 (v13.320.39): en estados terminales/cerrados el borrado ya no aplica.
  const esTerminal = ["Entregado", "EIR", "Cerrado", "Cancelado"].includes(estadoVisual);
  const puedeCancelar = ["Borrador", "Confirmado", "En Tránsito", "Llegada", "En Aduana", "Arribo"].includes(estadoVisual);
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
            {puedeCancelar && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setCancelarOpen(true);
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

