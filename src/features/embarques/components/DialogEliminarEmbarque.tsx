import { useEffect, useRef, useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useNavigate } from "react-router";
import {
  useEliminarEmbarque,
  useEmbarqueDependenciasFinancieras,
  type EmbarqueDependenciasFinancieras,
  type EmbarqueRow,
} from "@/features/embarques/hooks";
import { EmbarqueBloqueadoError, type MotivosBloqueoEmbarque } from "@/features/embarques/services";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { useRegistrarActividad } from "@/hooks/shared";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { useEmbarquePrivateScope } from "../hooks/useEmbarquePrivateScope";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { motivosADependencias } from "./eliminar/adaptadores";
import { estadoVerificacionBaja } from "./eliminar/estadoVerificacionBaja";
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

export default function DialogEliminarEmbarque(props: Props) {
  const scope = useEmbarquePrivateScope();
  // Reopening or changing actor/company/role/record requires a new confirmation.
  return <DialogEliminarEmbarqueSession key={JSON.stringify([props.embarque.id, props.open, ...scope.key])} {...props} />;
}

function DialogEliminarEmbarqueSession({ embarque, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [scopeConfirmacion] = useState(captureAuthOperationScope);
  const eliminarEmbarque = useEliminarEmbarque(scopeConfirmacion);
  const registrarActividad = useRegistrarActividad();
  const [operacionError, setOperacionError] = useState<string | null>(null);
  const [bloqueoServidor, setBloqueoServidor] = useState<MotivosBloqueoEmbarque | null>(null);
  const enviando = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const consulta = useEmbarqueDependenciasFinancieras(embarque.id, open);
  const {
    data: deps, refetch, verificationEnabled,
  } = consulta;
  const verificacion = estadoVerificacionBaja(consulta, operacionError);

  const bloqueado = Boolean(deps?.tieneDependencias) || bloqueoServidor !== null;
  const depsBloqueado: EmbarqueDependenciasFinancieras | null =
    bloqueoServidor !== null ? motivosADependencias(bloqueoServidor) : deps ?? null;

  const label = labelExpediente(embarque.expediente, embarque.id);
  const volverAVerificar = () => {
    if (!montado.current || !scopeConfirmacion.isCurrent() || !verificationEnabled) return;
    setOperacionError(null);
    setBloqueoServidor(null);
    void refetch();
  };
  const handleEliminar = async () => {
    if (!montado.current || !scopeConfirmacion.isCurrent() || enviando.current || !verificacion.puedeConfirmar || bloqueado) return false;
    const scope = scopeConfirmacion;
    enviando.current = true;
    let res: EliminarResultado;
    try {
      res = await ejecutarEliminacion(embarque.id, (id) => eliminarEmbarque.mutateAsync(id));
    } finally {
      enviando.current = false;
    }
    if (!montado.current || !scope.isCurrent()) return false;
    if (res.tipo === "ok") {
      registrarActividad.mutate({
        accion: 'eliminar',
        modulo: 'embarques',
        entidad_id: embarque.id,
        entidad_nombre: label,
        detalles: { cliente: embarque.cliente_nombre, modo: embarque.modo, tipo: embarque.tipo },
        authScope: scope,
      });
      notifySuccess(undefined, {
        title: "Embarque enviado a la papelera",
        description: `${label} dejó de aparecer en los listados activos.`,
      });
      navigate("/embarques");
      onOpenChange(false);
      return true;
    }
    if (res.tipo === "bloqueo") {
      setBloqueoServidor(res.motivos);
      return false;
    }
    const concurrente = typeof res.err === "object" && res.err !== null && "code" in res.err && res.err.code === "55P03";
    setOperacionError(concurrente
      ? "Otra operación está modificando el embarque. Vuelve a verificar sus dependencias antes de intentarlo otra vez."
      : "No se completó la eliminación. Vuelve a verificar las dependencias antes de intentarlo otra vez.");
    return false;
  };

  if (open && bloqueoServidor === null && (verificacion.verificando || verificacion.fallida)) {
    return (
      <DialogEmbarqueVerificandoAlert
        open={open}
        isLoading={verificacion.verificando}
        hasError={!verificacion.verificando && verificacion.fallida}
        errorMessage={operacionError ?? undefined}
        onRetry={verificationEnabled ? volverAVerificar : undefined}
        onClose={() => onOpenChange(false)}
      />
    );
  }

  if (open && bloqueado && depsBloqueado) {
    return (
      <DialogEmbarqueBloqueadoAlert
        open={open}
        expediente={label}
        deps={depsBloqueado}
        onRetry={volverAVerificar}
        onClose={() => onOpenChange(false)}
      />
    );
  }

  return (
    <DoubleConfirmDeleteDialog
      open={open && !bloqueado}
      onOpenChange={onOpenChange}
      entityName={`embarque ${label}`}
      description={
        <p>El embarque dejará de aparecer en los listados activos y se enviará a la papelera.</p>
      }
      finalDescription={
        <>
          Se dará de baja el embarque <strong>{label}</strong> junto con sus documentos, costos, conceptos de venta y notas asociados. No es un borrado físico. Un administrador podrá revisar su recuperación desde Papelera.
        </>
      }
      confirmLabel="Enviar a la papelera"
      isPending={eliminarEmbarque.isPending}
      onConfirm={handleEliminar}
    />
  );
}
