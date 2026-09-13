import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import SeccionCostosInternosPLLocal from "./SeccionCostosInternosPLLocal";
import SeccionCostosInternosPLDetalle from "./SeccionCostosInternosPLDetalle";
import type { FilaCostoLocal } from "./costosPLTypes";
import type { EstadoCotizacion } from "@/features/cotizacion/services/mutations/estado";

// Re-export para preservar la API pública (TablaCostosLocal importa este tipo desde aquí)
export type { FilaCostoLocal } from "./costosPLTypes";

interface PropsLocal {
  tipo: "local";
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

interface PropsDetalle {
  tipo: "detalle";
  cotizacionId: string;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  /** Sello optimista de la cotización abierta (ver componente de detalle). */
  cotizacionUpdatedAt?: string | null;
  /** v13.823.362 — El aviso de sincronización respeta estados inmutables. */
  estadoCotizacion: EstadoCotizacion;
}

type Props = PropsLocal | PropsDetalle;

/**
 * Dispatcher delgado: enruta al componente especializado según el modo.
 * - local: gestiona costos en memoria durante el wizard de NuevaCotizacion.
 * - detalle: carga/persiste costos desde la BD para una cotización existente.
 */
export default function SeccionCostosInternosPLUnificado(props: Props) {
  if (props.tipo === "local") {
    return <SeccionCostosInternosPLLocal filas={props.filas} setFilas={props.setFilas} />;
  }
  return (
    <SeccionCostosInternosPLDetalle
      cotizacionId={props.cotizacionId}
      conceptosUSD={props.conceptosUSD}
      conceptosMXN={props.conceptosMXN}
      cotizacionUpdatedAt={props.cotizacionUpdatedAt}
      estadoCotizacion={props.estadoCotizacion}
    />
  );
}
