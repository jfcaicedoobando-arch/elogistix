import { useNavigate } from "react-router-dom";
import { notifyInfo } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useEliminarOportunidad, useCrearCotizacionDesdeOportunidad } from "@/features/crm/hooks";
// Import directo (no por el barrel) para no acoplar los tests del hook.
import { useCrmProspectoOportunidad } from "./useCrmProspectoOportunidad";

/** CRM-COT-01: motivo visible cuando la oportunidad no puede cotizarse. */
export const MOTIVO_NO_COTIZABLE =
  "Sólo se puede cotizar una oportunidad abierta con cliente o con un prospecto calificado del CRM.";

interface EtapaLite {
  id: string;
  nombre: string;
  tipo: string;
  probabilidad_default?: number | null;
}

interface OpLite {
  id: string;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  origen?: string | null;
  destino?: string | null;
  etapa_id: string;
  modo: string;
}

function findCotizandoEtapa(etapas: EtapaLite[]): EtapaLite | undefined {
  return etapas.find((e) => /cotizando|cotizaci/i.test(e.nombre) && e.tipo === "abierta");
}

export function useOportunidadDetalleActions(op: OpLite, etapas: EtapaLite[]) {
  const navigate = useNavigate();
  const eliminar = useEliminarOportunidad();
  const crearCot = useCrearCotizacionDesdeOportunidad();
  // CRM-COT-01: sin cliente todavía se puede cotizar si la oportunidad es un
  // prospecto elegible; en ese caso se abre el cotizador ya precargado, sin
  // insertar borradores ni dar de alta al cliente.
  const tieneCliente = Boolean(op.cliente_id);
  const { data: prospecto, isLoading: prospectoLoading } = useCrmProspectoOportunidad(
    op.id,
    !tieneCliente,
  );
  const puedeCotizarProspecto = !tieneCliente && Boolean(prospecto);

  const handleEliminar = async () => {
    try {
      await eliminar.mutateAsync(op.id);
      crmToast.success("Oportunidad eliminada");
      navigate("/crm/oportunidades");
    } catch {
      // useEliminarOportunidad ya notifica el error en onError.
    }
  };

  const crearCotizacion = async () => {
    if (!tieneCliente) {
      if (!puedeCotizarProspecto) return;
      // Se abre el wizard existente con el prospecto/oportunidad precargados.
      navigate(`/cotizaciones/nueva?oportunidad=${op.id}`);
      return;
    }
    try {
      const cotizandoEtapa = findCotizandoEtapa(etapas);
      const result = await crearCot.mutateAsync({
        oportunidad: {
          id: op.id,
          cliente_id: op.cliente_id ?? null,
          cliente_nombre: op.cliente_nombre ?? null,
          origen: op.origen ?? null,
          destino: op.destino ?? null,
          etapa_id: op.etapa_id,
          modo: op.modo,
        },
        etapaCotizandoId: cotizandoEtapa?.id,
        etapaCotizandoProbabilidad: cotizandoEtapa?.probabilidad_default ?? 0,
      });
      if (result.avisoEtapa) {
        // v13.823.83: un único toast informativo con la advertencia de etapa;
        // antes el hook también emitía un success, generando un aviso duplicado.
        notifyInfo(undefined, {
          title: `Cotización creada · ${result.folio}`,
          description: `La etapa de la oportunidad no se pudo actualizar: ${result.avisoEtapa}. Muévela manualmente.`,
          duration: 5000,
        });
      } else {
        crmToast.success(`Cotización creada · ${result.folio}`);
      }
      navigate(`/cotizaciones/${result.id}/editar`);
    } catch {
      // useCrearCotizacionDesdeOportunidad ya notifica el error en onError;
      // su reintento idempotente vive en el hook, no aquí.
    }
  };

  return {
    handleEliminar,
    crearCotizacion,
    crearCotPending: crearCot.isPending || (!tieneCliente && prospectoLoading),
    puedeCotizar: tieneCliente || puedeCotizarProspecto,
    motivoNoCotizar: tieneCliente || puedeCotizarProspecto ? undefined : MOTIVO_NO_COTIZABLE,
  };
}
