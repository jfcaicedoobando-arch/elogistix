/**
 * Lógica del botón "Crear embarque" con flujo de revalidación de tarifa
 * (Fase 1). Extraído del componente `CrearEmbarqueConRevalidacion` para
 * mantenerlo bajo el límite de líneas (Power-of-10); sin cambios de
 * comportamiento.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCrearEmbarqueBorradorConDecision,
  useSolicitarReaprobacion,
} from "@/features/cotizacion/hooks/useRevalidacionTarifa";
import { revalidarTarifa } from "@/features/cotizacion/services/revalidacion";
import type { ResultadoRevalidacion, DecisionTarifa } from "@/features/cotizacion/domain/revalidacionTarifa";
import { notifyError, notifyWarning } from "@/lib/ui/appFeedback";
import {
  tieneCostosCargados,
  CandadoCostosNoVerificableError,
} from "@/features/cotizacion/services/candadoCostos";
import { esErrorDeEsquemaBD } from "@/features/cotizacion/domain/erroresEsquemaBD";

export function useCrearEmbarqueConRevalidacion(cotizacionId: string) {
  const navigate = useNavigate();
  const [revalidando, setRevalidando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRevalidacion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [buscarOpen, setBuscarOpen] = useState(false);
  const [bloqueadoPorEsquema, setBloqueadoPorEsquema] = useState(false);
  // Ref para evitar dobles-invocaciones si el click llega antes del re-render.
  const enVueloRef = useRef(false);

  const crearMut = useCrearEmbarqueBorradorConDecision();
  const reaprobarMut = useSolicitarReaprobacion();

  const ejecutarCreacion = async (
    decision: DecisionTarifa,
    tarifaIdAplicada: string | null,
    delta: unknown,
  ) => {
    // Fase 2 (creación del embarque): los errores los notifica la propia
    // mutation con su mensaje real. Aquí sólo evitamos que el rechazo escale
    // al catch de la revalidación (que mostraría un aviso equivocado) o quede
    // como promesa no manejada.
    // v13.823.347 — guard de reentrada compartido: Mantener/Refrescar/
    // Sustituir/Re-aprobada también pasan por aquí, así que dos clics rápidos
    // ya no lanzan dos decisiones antes del re-render.
    if (enVueloRef.current) return;
    enVueloRef.current = true;
    try {
      const embarqueId = await crearMut.mutateAsync({
        cotizacionId,
        decision,
        tarifaIdAplicada,
        delta,
      });
      setModalOpen(false);
      navigate(`/embarques/${embarqueId}`);
    } catch {
      /* notificado por useCrearEmbarqueBorradorConDecision */
    } finally {
      enVueloRef.current = false;
    }
  };

  const notificarErrorRevalidacion = (err: unknown) => {
    const error = err as Error;
    const msg = error?.message ?? "";
    if (esErrorDeEsquemaBD(msg)) {
      // Bug de sistema: bloqueamos el botón para no producir reintentos
      // duplicados (cada reintento genera un Sentry idéntico).
      setBloqueadoPorEsquema(true);
      notifyError(undefined, {
        title: "No se pudo revalidar la tarifa — bug de sistema",
        description:
          "El backend hace referencia a una columna que ya no existe. Nuestro equipo ya recibió el reporte; por favor avisa a soporte con el ID de la cotización y evita reintentar.",
        error,
        method: "REVALIDAR_TARIFA",
      });
    } else {
      notifyError(undefined, {
        title: `No se pudo revalidar la tarifa: ${msg}`,
        error,
        method: "REVALIDAR_TARIFA",
      });
    }
  };

  /**
   * v13.823.370 (P1-1) — Candado de costos en la ruta real de producción. Esta
   * ruta (CrearEmbarqueConRevalidacion) no pasaba por `tieneCostosCargados`, que
   * sólo vivía en `useCrearEmbarqueBorradorHandlers`, así que una cotización
   * Aceptada con venta pero sin desglose de costos llegaba a revalidar. Es
   * fail-closed: si la verificación misma falla, no se procede.
   * El servidor lo refuerza (LC_COT_SIN_COSTOS) para llamadas directas a la RPC.
   */
  const costosVerificados = async (): Promise<boolean> => {
    try {
      if (await tieneCostosCargados(cotizacionId)) return true;
      notifyWarning(undefined, {
        title: "La cotización no tiene costos cargados",
        description:
          "Captura el desglose de costos en la cotización (paso 2) antes de crear el embarque.",
      });
      return false;
    } catch (err) {
      if (err instanceof CandadoCostosNoVerificableError) {
        notifyWarning(undefined, {
          title: "No pudimos verificar los costos",
          description:
            "No se pudo comprobar si la cotización tiene costos cargados. Revisa tu conexión e inténtalo de nuevo.",
        });
        return false;
      }
      throw err;
    }
  };

  const handleClick = async () => {
    // Guard #1: evita re-entrada síncrona (doble click rápido).
    if (enVueloRef.current || bloqueadoPorEsquema) return;
    if (!(await costosVerificados())) return;
    enVueloRef.current = true;
    setRevalidando(true);
    // Fase 1 — revalidación. Su catch NO debe abarcar la creación del embarque.
    let r: ResultadoRevalidacion | null = null;
    try {
      r = await revalidarTarifa(cotizacionId);
      setResultado(r);
    } catch (err) {
      notificarErrorRevalidacion(err);
    } finally {
      setRevalidando(false);
      enVueloRef.current = false;
    }
    if (!r) return;
    if (r.severidad === "sin_cambios") {
      await ejecutarCreacion("sin_cambios", r.tarifa_id_vigente ?? null, { cambios: r.cambios });
    } else {
      setModalOpen(true);
    }
  };

  const handleMantener = () =>
    ejecutarCreacion("mantenida_por_operaciones", resultado?.tarifa_id_vigente ?? null, {
      cambios: resultado?.cambios ?? [],
    });

  const handleRefrescar = () =>
    ejecutarCreacion("refrescada", resultado?.tarifa_id_vigente ?? null, {
      cambios: resultado?.cambios ?? [],
    });

  // R201-COT-02: ventas ya re-aprobó este delta; operaciones crea el embarque
  // con la decisión `reaprobada_ventas` en vez de volver a pedir aprobación.
  const handleCrearConReaprobacion = () =>
    ejecutarCreacion("reaprobada_ventas", resultado?.tarifa_id_vigente ?? null, {
      cambios: resultado?.cambios ?? [],
      max_delta_pct: resultado?.max_delta_pct ?? 0,
      reaprobacion_vigente: true,
    });

  const handleSustituir = () => {
    setModalOpen(false);
    setBuscarOpen(true);
  };

  const handleTarifaElegida = (row: { id: string }) => {
    setBuscarOpen(false);
    void ejecutarCreacion("sustituida", row.id, { cambios: resultado?.cambios ?? [] });
  };

  const handleSolicitarReaprobacion = () => {
    if (enVueloRef.current) return;
    enVueloRef.current = true;
    reaprobarMut.mutate(
      {
        cotizacionId,
        delta: {
          cambios: resultado?.cambios ?? [],
          conceptos: resultado?.cambios.length ?? 0,
          max_delta_pct: resultado?.max_delta_pct ?? 0,
          // B-097: el banner necesita saber si el bloqueo fue por vigencia
          // vencida o por cambio de precio para mostrar el copy correcto.
          tarifa_vigente: resultado?.tarifa_vigente ?? true,
          severidad: resultado?.severidad ?? "bloqueante",
        },
      },
      {
        onSuccess: () => {
          setModalOpen(false);
        },
        onSettled: () => {
          enVueloRef.current = false;
        },
      },
    );
  };

  return {
    resultado,
    modalOpen,
    setModalOpen,
    buscarOpen,
    setBuscarOpen,
    bloqueadoPorEsquema,
    revalidando,
    loading: crearMut.isPending || reaprobarMut.isPending,
    handleClick,
    handleMantener,
    handleRefrescar,
    handleSustituir,
    handleTarifaElegida,
    handleSolicitarReaprobacion,
    handleCrearConReaprobacion,
  };
}
