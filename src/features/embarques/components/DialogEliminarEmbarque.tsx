import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useToast } from "@/hooks/shared";
import { useNavigate } from "react-router-dom";
import {
  useEliminarEmbarque,
  useEmbarqueDependenciasFinancieras,
  type EmbarqueRow,
  type FacturaLigada,
} from "@/features/embarques/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { AlertTriangle, Ban, Loader2 } from "lucide-react";

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatoFolio(f: FacturaLigada): string {
  return f.folio ?? f.id.slice(0, 8);
}

export default function DialogEliminarEmbarque({ embarque, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();
  const [paso2, setPaso2] = useState(false);

  const { data: deps, isLoading: depsLoading, error: depsError } =
    useEmbarqueDependenciasFinancieras(embarque.id, open);

  const bloqueado = Boolean(deps?.tieneDependencias);

  const handleEliminar = async () => {
    if (bloqueado) {
      notifyError(toast, {
        title: "No se puede eliminar",
        description: "El embarque tiene documentos financieros asociados.",
        method: "HANDLE_ELIMINAR_BLOQUEADO",
      });
      onOpenChange(false);
      setPaso2(false);
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
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al eliminar", description: getErrorMessage(err), error: err, method: "HANDLE_ELIMINAR" });
    } finally {
      onOpenChange(false);
      setPaso2(false);
    }
  };

  // Diálogo de bloqueo cuando hay dependencias financieras
  if (open && bloqueado && !paso2) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              No se puede eliminar el embarque
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  El embarque <strong>{embarque.expediente}</strong> tiene documentos financieros asociados.
                  Cancela primero los siguientes documentos antes de eliminarlo:
                </p>

                {deps && deps.cxc.count > 0 && (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="font-semibold text-foreground">
                      Facturas a clientes (CxC): {deps.cxc.count}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {deps.cxc.facturas.map((f) => (
                        <li key={f.id}>
                          {formatoFolio(f)}{f.estado ? ` — ${f.estado}` : ''}
                        </li>
                      ))}
                      {deps.cxc.count > deps.cxc.facturas.length && (
                        <li>… y {deps.cxc.count - deps.cxc.facturas.length} más</li>
                      )}
                    </ul>
                  </div>
                )}

                {deps && deps.cxp.count > 0 && (
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="font-semibold text-foreground">
                      Facturas de proveedores (CxP): {deps.cxp.count}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {deps.cxp.facturas.map((f) => (
                        <li key={f.id}>
                          {formatoFolio(f)}{f.estado ? ` — ${f.estado}` : ''}
                        </li>
                      ))}
                      {deps.cxp.count > deps.cxp.facturas.length && (
                        <li>… y {deps.cxp.count - deps.cxp.facturas.length} más</li>
                      )}
                    </ul>
                  </div>
                )}

                {deps && (deps.notasCredito > 0 || deps.pagos > 0) && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div>
                      {deps.notasCredito > 0 && <p>Notas de crédito ligadas: <strong>{deps.notasCredito}</strong></p>}
                      {deps.pagos > 0 && <p>Pagos registrados: <strong>{deps.pagos}</strong></p>}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Una vez que canceles o desliges estos documentos del embarque, podrás intentar la eliminación nuevamente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => onOpenChange(false)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <>
      {/* Paso 1 */}
      <AlertDialog open={open && !paso2} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar embarque {embarque.expediente}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>¿Estás seguro de que deseas eliminar este embarque? Esta acción no se puede deshacer.</p>
                {depsLoading && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando documentos financieros asociados…
                  </p>
                )}
                {depsError && (
                  <p className="text-xs text-destructive">
                    No se pudo verificar dependencias financieras. Intenta nuevamente.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setPaso2(true)}
              disabled={depsLoading || Boolean(depsError)}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paso 2 */}
      <AlertDialog open={paso2} onOpenChange={(v) => { if (!v) { setPaso2(false); onOpenChange(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmación final</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los documentos, costos, conceptos de venta y notas asociados al embarque <strong>{embarque.expediente}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleEliminar}
              disabled={eliminarEmbarque.isPending}
            >
              {eliminarEmbarque.isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
