/**
 * Botón "Crear embarque" con flujo de revalidación de tarifa (Fase 1).
 *
 * 1. Llama `revalidar_tarifa_cotizacion`.
 * 2. Si `sin_cambios` → crea embarque directo con `decision='sin_cambios'`.
 * 3. Si `informativa` → abre `RevalidarTarifaModal` con opciones mantener /
 *    refrescar / sustituir (BuscarTarifaDialog).
 * 4. Si `bloqueante` → modal sólo permite "Solicitar re-aprobación a ventas".
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { RevalidarTarifaModal } from "@/features/cotizacion/components/revalidacion/RevalidarTarifaModal";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import {
  useCrearEmbarqueBorradorConDecision,
  useSolicitarReaprobacion,
} from "@/features/cotizacion/hooks/useRevalidacionTarifa";
import { revalidarTarifa } from "@/features/cotizacion/services/revalidacion";
import type { ResultadoRevalidacion } from "@/features/cotizacion/domain/revalidacionTarifa";
import { notifyError } from "@/components/shared/utils/appFeedback";

interface Props {
  cotizacionId: string;
  numContenedores: number;
}

export function CrearEmbarqueConRevalidacion({ cotizacionId, numContenedores }: Props) {
  const navigate = useNavigate();
  const [revalidando, setRevalidando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRevalidacion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [buscarOpen, setBuscarOpen] = useState(false);

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
    setRevalidando(true);
    try {
      const r = await revalidarTarifa(cotizacionId);
      setResultado(r);
      if (r.severidad === "sin_cambios") {
        // Crear directo
        await ejecutarCreacion("sin_cambios", r.tarifa_id_vigente ?? null, { cambios: r.cambios });
      } else {
        setModalOpen(true);
      }
    } catch (err) {
      notifyError(undefined, {
        title: `No se pudo revalidar la tarifa: ${(err as Error).message}`,
        error: err as Error,
        method: "REVALIDAR_TARIFA",
      });
    } finally {
      setRevalidando(false);
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
      <Button size="sm" onClick={handleClick} disabled={revalidando || loading}>
        {revalidando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Crear embarque
        {numContenedores > 1 && <Badge variant="secondary" className="ml-2">{numContenedores}</Badge>}
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
