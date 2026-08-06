/**
 * Status Action Bar del detalle de factura de proveedor.
 * Muestra el estado de aprobación a la izquierda y la acción primaria contextual
 * a la derecha (Aprobar/Rechazar cuando está pendiente, Registrar pago cuando
 * está aprobada con saldo). Acciones secundarias van en un overflow menu.
 */
import { Banknote, Check, MoreHorizontal, Pencil, FileCheck2, Ban, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAprobarFactura } from "@/features/cxp/hooks/useAprobarFactura";
import { useState } from "react";
import type { FacturaCxP } from "@/features/cxp/services";
import type { FacturaFlags } from "./DialogDetallePagosProveedor.flags";
import { AprobarRechazarDialogs } from "./DialogDetallePagosProveedor.aprobardialogs";

interface Props {
  factura: FacturaCxP;
  canEdit: boolean;
  puedeAprobar: boolean;
  flags: FacturaFlags;
  onPagar?: (f: FacturaCxP) => void;
  onEditar?: (f: FacturaCxP) => void;
  onEliminar?: (f: FacturaCxP) => void;
  onCerrarSinPago?: (f: FacturaCxP) => void;
  onCancelar?: () => void;
}

export function StatusActionBar({
  factura: f, canEdit, puedeAprobar, flags,
  onPagar, onEditar, onEliminar, onCerrarSinPago, onCancelar,
}: Props) {
  const [openAprobar, setOpenAprobar] = useState(false);
  const [openRechazar, setOpenRechazar] = useState(false);
  const aprobar = useAprobarFactura();
  const cancelada = f.estado === "Cancelada";
  const pendiente = f.estado_aprobacion === "pendiente" && !cancelada;
  const ctxLabel = [f.folio_interno, f.proveedor_nombre].filter(Boolean).join(" · ");

  const hasOverflow = canEdit && (onEditar || (onCerrarSinPago && flags.puedeCerrarSinPago) || onCancelar || onEliminar);

  return (
    <div className="px-6 py-3 border-b bg-accent/5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        {/* El estado de aprobación ya se comunica en el stepper del encabezado;
            aquí sólo se muestra el motivo cuando fue rechazada. */}
        {f.estado_aprobacion === "rechazada" && f.motivo_rechazo && (
          <span className="text-xs text-muted-foreground italic truncate max-w-md">
            Motivo del rechazo: {f.motivo_rechazo}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {puedeAprobar && pendiente && (
          <>
            <Button size="sm" variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setOpenRechazar(true)} disabled={aprobar.isPending}>
              <X className="h-4 w-4 mr-1" /> Rechazar
            </Button>
            <Button size="sm" onClick={() => setOpenAprobar(true)} disabled={aprobar.isPending}>
              <Check className="h-4 w-4 mr-1" /> Aprobar factura
            </Button>
          </>
        )}
        {!pendiente && onPagar && flags.pagable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" onClick={() => onPagar(f)} disabled={!flags.aprobada}>
                  <Banknote className="h-4 w-4 mr-1" /> Registrar pago
                </Button>
              </span>
            </TooltipTrigger>
            {!flags.aprobada && <TooltipContent>Requiere aprobación antes de pagar</TooltipContent>}
          </Tooltip>
        )}

        {hasOverflow && (
          <OverflowMenu
            f={f} flags={flags} cancelada={cancelada}
            onEditar={onEditar} onCerrarSinPago={onCerrarSinPago}
            onCancelar={onCancelar} onEliminar={onEliminar}
          />
        )}
      </div>

      <AprobarRechazarDialogs
        f={f} openAprobar={openAprobar} openRechazar={openRechazar}
        setOpenAprobar={setOpenAprobar} setOpenRechazar={setOpenRechazar}
        aprobar={aprobar} ctxLabel={ctxLabel}
      />
    </div>
  );
}

function OverflowMenu({
  f, flags, cancelada, onEditar, onCerrarSinPago, onCancelar, onEliminar,
}: {
  f: FacturaCxP;
  flags: FacturaFlags;
  cancelada: boolean;
  onEditar?: (f: FacturaCxP) => void;
  onCerrarSinPago?: (f: FacturaCxP) => void;
  onCancelar?: () => void;
  onEliminar?: (f: FacturaCxP) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Más acciones">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {onEditar && (
          <DropdownMenuItem onSelect={() => onEditar(f)}>
            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar factura
          </DropdownMenuItem>
        )}
        {onCerrarSinPago && flags.puedeCerrarSinPago && (
          <DropdownMenuItem onSelect={() => onCerrarSinPago(f)} className="text-warning focus:text-warning">
            <FileCheck2 className="h-3.5 w-3.5 mr-2" /> Cerrar sin pago
          </DropdownMenuItem>
        )}
        {(onCancelar || onEliminar) && <DropdownMenuSeparator />}
        {onCancelar && !cancelada && (
          <DropdownMenuItem onSelect={onCancelar} className="text-destructive focus:text-destructive">
            <Ban className="h-3.5 w-3.5 mr-2" /> Cancelar factura
          </DropdownMenuItem>
        )}
        {onEliminar && (
          <DropdownMenuItem
            onSelect={() => flags.puedeEliminar && onEliminar(f)}
            disabled={!flags.puedeEliminar}
            className="text-destructive focus:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar factura
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
