import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/shared/useToast";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { useEliminarOportunidad, useCrearCotizacionDesdeOportunidad } from "@/hooks/crm";

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
  const { toast } = useToast();
  const eliminar = useEliminarOportunidad();
  const crearCot = useCrearCotizacionDesdeOportunidad();

  const handleEliminar = async () => {
    try {
      await eliminar.mutateAsync(op.id);
      notifySuccess(toast, { title: "Oportunidad eliminada" });
      navigate("/crm/oportunidades");
    } catch (e) {
      notifyError(toast, { title: "Error", description: e instanceof Error ? e.message : undefined });
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
      notifySuccess(toast, { title: "Cotización creada", description: `Folio ${result.folio}` });
      navigate(`/cotizaciones/${result.id}/editar`);
    } catch (e) {
      notifyError(toast, { title: "No se pudo crear", description: e instanceof Error ? e.message : undefined });
    }
  };

  return { handleEliminar, crearCotizacion, crearCotPending: crearCot.isPending };
}
