/**
 * Botón "Crear embarque" con flujo de revalidación de tarifa (Fase 1).
 *
 * 1. Llama `revalidar_tarifa_cotizacion`.
 * 2. Si `sin_cambios` → crea embarque directo con `decision='sin_cambios'`.
 * 3. Si `informativa` → abre `RevalidarTarifaModal` con opciones mantener /
 *    refrescar / sustituir (BuscarTarifaDialog).
 * 4. Si `bloqueante` → modal sólo permite "Solicitar re-aprobación a ventas".
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { RevalidarTarifaModal } from "@/features/cotizacion/components/revalidacion/RevalidarTarifaModal";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import {
  useCrearEmbarqueBorradorConDecision,
  useSolicitarReaprobacion,
} from "@/features/cotizacion/hooks/useRevalidacionTarifa";
import { revalidarTarifa } from "@/features/cotizacion/services/revalidacion";
import type { ResultadoRevalidacion } from "@/features/cotizacion/domain/revalidacionTarifa";
import { notifyError } from "@/lib/ui/appFeedback";

interface Props {
  cotizacionId: string;
  numContenedores: number;
}

/**
 * Detecta errores de esquema/contrato de la BD (columnas o campos inexistentes,
 * mismatch de tipos de retorno). Estos son bugs de sistema, no de datos —
 * reintentar no ayuda y sólo produce ruido en Sentry.
 */
function esErrorDeEsquemaBD(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    /column\s+\S+\s+does not exist/.test(m) ||
    /has no field/.test(m) ||
    /structure of query does not match function result type/.test(m) ||
    /return type mismatch/.test(m) ||
    /relation\s+\S+\s+does not exist/.test(m)
  );
}

export function CrearEmbarqueConRevalidacion({ cotizacionId, numContenedores }: Props) {
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
    decision: "sin_cambios" | "mantenida_por_operaciones" | "refrescada" | "sustituida",
    tarifaIdAplicada: string | null,
    delta: unknown,
  ) => {
    const embarqueId = await crearMut.mutateAsync({
      cotizacionId,
      decision,
      tarifaIdAplicada,
      delta,
    });
    setModalOpen(false);
    navigate(`/embarques/${embarqueId}`);
  };

  const handleClick = async () => {
    // Guard #1: evita re-entrada síncrona (doble click rápido).
    if (enVueloRef.current || bloqueadoPorEsquema) return;
    enVueloRef.current = true;
    setRevalidando(true);
    try {
      const r = await revalidarTarifa(cotizacionId);
      setResultado(r);
      if (r.severidad === "sin_cambios") {
        await ejecutarCreacion("sin_cambios", r.tarifa_id_vigente ?? null, { cambios: r.cambios });
      } else {
        setModalOpen(true);
      }
    } catch (err) {
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
    } finally {
      setRevalidando(false);
      enVueloRef.current = false;
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

  const handleSustituir = () => {
    setModalOpen(false);
    setBuscarOpen(true);
  };

  const handleTarifaElegida = (row: { id: string }) => {
    setBuscarOpen(false);
    void ejecutarCreacion("sustituida", row.id, { cambios: resultado?.cambios ?? [] });
  };

  const handleSolicitarReaprobacion = () => {
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
      },
    );
  };

  const loading = crearMut.isPending || reaprobarMut.isPending;

  return (
    <>
      <Button
        size="sm"
        onClick={handleClick}
        disabled={revalidando || loading || bloqueadoPorEsquema}
        variant={bloqueadoPorEsquema ? "outline" : "default"}
        title={
          bloqueadoPorEsquema
            ? "Revalidación deshabilitada por un bug de sistema. Contacta a soporte."
            : undefined
        }
      >
        {revalidando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {bloqueadoPorEsquema ? <AlertTriangle className="h-4 w-4 mr-2 text-warning" /> : null}
        {bloqueadoPorEsquema ? "Revalidación no disponible" : "Crear embarque"}
        {!bloqueadoPorEsquema && numContenedores > 1 && (
          <Badge variant="secondary" className="ml-2">{numContenedores}</Badge>
        )}
      </Button>


      <RevalidarTarifaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        resultado={resultado}
        onMantener={handleMantener}
        onRefrescar={handleRefrescar}
        onSustituir={handleSustituir}
        onSolicitarReaprobacion={handleSolicitarReaprobacion}
        loading={loading}
      />

      <BuscarTarifaDialog
        open={buscarOpen}
        onOpenChange={setBuscarOpen}
        selectLabel="Usar esta tarifa para el embarque"
        onElegir={handleTarifaElegida}
      />
    </>
  );
}
