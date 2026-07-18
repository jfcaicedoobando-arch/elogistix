import { useState } from "react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useToast } from "@/hooks/shared";
import { useNavigate } from "react-router-dom";
import {
  useEliminarEmbarque,
  useEmbarqueDependenciasFinancieras,
  type EmbarqueDependenciasFinancieras,
  type EmbarqueRow,
} from "@/features/embarques/hooks";
import { EmbarqueBloqueadoError, type MotivosBloqueoEmbarque } from "@/features/embarques/services";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { Ban, Loader2 } from "lucide-react";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import DialogEliminarEmbarqueBloqueado from "./DialogEliminarEmbarqueBloqueado";

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Adapta los motivos server-side (Fase E) al shape del hook client-side
 * `useEmbarqueDependenciasFinancieras` que consume el diálogo de bloqueo.
 * No conocemos los folios/ids desde el server (sólo counts + expediente),
 * así que se dejan las listas vacías y el componente muestra "… y N más".
 */
function motivosADependencias(m: MotivosBloqueoEmbarque): EmbarqueDependenciasFinancieras {
  return {
    tieneDependencias: true,
    cxc: { count: m.facturas, facturas: [] },
    cxp: { count: m.cxp, facturas: [] },
    notasCredito: m.notas_credito_cxc + m.notas_credito_cxp,
    pagos: m.pagos_cxc + m.pagos_cxp,
  };
}

export default function DialogEliminarEmbarque({ embarque, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();
  const [dependenciasVerificadas, setDependenciasVerificadas] = useState(false);
  const [bloqueoServidor, setBloqueoServidor] = useState<MotivosBloqueoEmbarque | null>(null);

  const { data: deps, isLoading: depsLoading, error: depsError } =
    useEmbarqueDependenciasFinancieras(embarque.id, open);

  const bloqueado = Boolean(deps?.tieneDependencias) || bloqueoServidor !== null;

  const handleEliminar = async () => {
    if (bloqueado) {
      notifyError(toast, {
        title: "No se puede eliminar",
        description: "El embarque tiene documentos financieros asociados.",
        method: "HANDLE_ELIMINAR_BLOQUEADO",
      });
      onOpenChange(false);
      return;
    }
    try {
      await eliminarEmbarque.mutateAsync(embarque.id);
      registrarActividad.mutate({
        accion: 'eliminar',
        modulo: 'embarques',
        entidad_id: embarque.id,
        entidad_nombre: embarque.expediente,
        detalles: { cliente: embarque.cliente_nombre, modo: embarque.modo, tipo: embarque.tipo },
      });
      notifySuccess(toast, { title: "Embarque eliminado", description: `${embarque.expediente} fue eliminado permanentemente.` });
      navigate("/embarques");
      onOpenChange(false);
    } catch (err: unknown) {
      // v13.301.74 (Fase E): el server bloquea si aparecen dependencias
      // fiscales entre la verificación en cliente y el commit del RPC.
      if (err instanceof EmbarqueBloqueadoError) {
        setBloqueoServidor(err.motivos);
        return;
      }
      notifyError(toast, { title: "Error al eliminar", description: getErrorMessage(err), error: err, method: "HANDLE_ELIMINAR" });
      onOpenChange(false);
    }
  };

  const depsBloqueado: EmbarqueDependenciasFinancieras | null =
    bloqueoServidor !== null ? motivosADependencias(bloqueoServidor) : deps ?? null;

  // Rama especial: bloqueado por dependencias financieras (client-side check
  // o server-side EmbarqueBloqueadoError). Sólo informativo.
  if (open && bloqueado && depsBloqueado) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" aria-hidden />
              No se puede eliminar el embarque
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <DialogEliminarEmbarqueBloqueado expediente={embarque.expediente} deps={depsBloqueado} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setBloqueoServidor(null); onOpenChange(false); }}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Mientras se verifican dependencias, mostramos un placeholder ligero para
  // evitar abrir el doble-confirm antes de saber si está bloqueado.
  if (open && (depsLoading || depsError) && !dependenciasVerificadas) {
    // Habilitamos el flujo canónico una vez que la query resuelve sin bloqueo.
    if (!depsLoading && !depsError && !bloqueado) {
      setDependenciasVerificadas(true);
    }
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle>Verificando dependencias…</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {depsLoading && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Verificando documentos financieros asociados…
                  </p>
                )}
                {depsError && (
                  <p className="text-destructive">
                    No se pudo verificar dependencias financieras. Intenta nuevamente.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => onOpenChange(false)}>Cerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <DoubleConfirmDeleteDialog
      open={open && !bloqueado}
      onOpenChange={(v) => {
        if (!v) setDependenciasVerificadas(false);
        onOpenChange(v);
      }}
      entityName={`embarque ${embarque.expediente}`}
      description={
        <p>¿Estás seguro de que deseas eliminar este embarque? Esta acción no se puede deshacer.</p>
      }
      finalDescription={
        <>
          Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los documentos, costos, conceptos de venta y notas asociados al embarque <strong>{embarque.expediente}</strong>.
        </>
      }
      isPending={eliminarEmbarque.isPending}
      onConfirm={handleEliminar}
    />
  );
}
