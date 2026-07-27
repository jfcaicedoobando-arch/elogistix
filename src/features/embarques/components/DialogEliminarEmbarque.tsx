import { useState } from "react";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useNavigate } from "react-router-dom";
import {
  useEliminarEmbarque,
  useEmbarqueDependenciasFinancieras,
  type EmbarqueDependenciasFinancieras,
  type EmbarqueRow,
} from "@/features/embarques/hooks";
import { EmbarqueBloqueadoError, type MotivosBloqueoEmbarque } from "@/features/embarques/services";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { useRegistrarActividad } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { motivosADependencias } from "./eliminar/adaptadores";
import {
  DialogEmbarqueBloqueadoAlert,
  DialogEmbarqueVerificandoAlert,
} from "./eliminar/DialogEmbarqueAlerts";

interface Props {
  embarque: EmbarqueRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Resultado del intento de eliminación: `ok` cuando la RPC pasó, `bloqueo`
 * cuando el server lanzó `LC_EMBARQUE_BLOQUEADO` con motivos concretos, y
 * `error` para cualquier otro fallo genérico.
 */
type EliminarResultado =
  | { tipo: "ok" }
  | { tipo: "bloqueo"; motivos: MotivosBloqueoEmbarque }
  | { tipo: "error"; err: unknown };

async function ejecutarEliminacion(
  embarqueId: string,
  mutate: (id: string) => Promise<unknown>,
): Promise<EliminarResultado> {
  try {
    await mutate(embarqueId);
    return { tipo: "ok" };
  } catch (err) {
    if (err instanceof EmbarqueBloqueadoError) {
      return { tipo: "bloqueo", motivos: err.motivos };
    }
    return { tipo: "error", err };
  }
}

export default function DialogEliminarEmbarque({ embarque, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();
  const [dependenciasVerificadas, setDependenciasVerificadas] = useState(false);
  const [bloqueoServidor, setBloqueoServidor] = useState<MotivosBloqueoEmbarque | null>(null);

  const { data: deps, isLoading: depsLoading, error: depsError } =
    useEmbarqueDependenciasFinancieras(embarque.id, open);

  const bloqueado = Boolean(deps?.tieneDependencias) || bloqueoServidor !== null;
  const depsBloqueado: EmbarqueDependenciasFinancieras | null =
    bloqueoServidor !== null ? motivosADependencias(bloqueoServidor) : deps ?? null;

  const label = labelExpediente(embarque.expediente, embarque.id);
  const handleEliminar = async () => {
    const res = await ejecutarEliminacion(embarque.id, (id) => eliminarEmbarque.mutateAsync(id));
    if (res.tipo === "ok") {
      registrarActividad.mutate({
        accion: 'eliminar',
        modulo: 'embarques',
        entidad_id: embarque.id,
        entidad_nombre: label,
        detalles: { cliente: embarque.cliente_nombre, modo: embarque.modo, tipo: embarque.tipo },
      });
      notifySuccess(undefined, {
        title: "Embarque eliminado",
        description: `${label} fue eliminado permanentemente.`,
      });
      navigate("/embarques");
      onOpenChange(false);
      return;
    }
    if (res.tipo === "bloqueo") {
      setBloqueoServidor(res.motivos);
      return;
    }
    notifyError(undefined, {
      title: "Error al eliminar",
      description: getErrorMessage(res.err),
      error: res.err,
      method: "HANDLE_ELIMINAR",
    });
    onOpenChange(false);
  };

  if (open && bloqueado && depsBloqueado) {
    return (
      <DialogEmbarqueBloqueadoAlert
        open={open}
        expediente={label}
        deps={depsBloqueado}
        onClose={() => { setBloqueoServidor(null); onOpenChange(false); }}
      />
    );
  }

  if (open && (depsLoading || depsError) && !dependenciasVerificadas) {
    if (!depsLoading && !depsError && !bloqueado) {
      setDependenciasVerificadas(true);
    }
    return (
      <DialogEmbarqueVerificandoAlert
        open={open}
        isLoading={depsLoading}
        hasError={Boolean(depsError)}
        onClose={() => onOpenChange(false)}
      />
    );
  }

  return (
    <DoubleConfirmDeleteDialog
      open={open && !bloqueado}
      onOpenChange={(v) => {
        if (!v) setDependenciasVerificadas(false);
        onOpenChange(v);
      }}
      entityName={`embarque ${label}`}
      description={
        <p>¿Estás seguro de que deseas eliminar este embarque? Esta acción no se puede deshacer.</p>
      }
      finalDescription={
        <>
          Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente todos los documentos, costos, conceptos de venta y notas asociados al embarque <strong>{label}</strong>.
        </>
      }
      isPending={eliminarEmbarque.isPending}
      onConfirm={handleEliminar}
    />
  );
}
