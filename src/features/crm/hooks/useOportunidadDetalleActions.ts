import { useNavigate } from "react-router-dom";
import { notifyError, notifyInfo } from "@/lib/ui/appFeedback";
import { crmToast } from "@/features/crm/lib/crmToast";
import { useEliminarOportunidad, useCrearCotizacionDesdeOportunidad } from "@/features/crm/hooks";

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

  const handleEliminar = async () => {
    try {
      await eliminar.mutateAsync(op.id);
      crmToast.success("Oportunidad eliminada");
      navigate("/crm/oportunidades");
    } catch (e) {
      notifyError(undefined, { title: "Error", description: e instanceof Error ? e.message : undefined, error: e, method: "HANDLE_ELIMINAR" });
    }
  };

  const crearCotizacion = async () => {
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
    } catch (e) {
      notifyError(undefined, { title: "No se pudo crear", description: e instanceof Error ? e.message : undefined, error: e, method: "CREAR_COTIZACION" });
    }
  };

  return { handleEliminar, crearCotizacion, crearCotPending: crearCot.isPending };
}
