/**
 * Tipos de props de `CotizacionDetalleContenido`.
 * Extraídos para mantener el componente por debajo de 200 líneas (Power of 10).
 */
import type { AppRole } from "@/types/appRole";
import type { EnvioRow } from "@/features/cotizacion/services/envios";
import type { useCotizacionDetalleState } from "@/features/cotizacion/hooks";

export type DetalleState = ReturnType<typeof useCotizacionDetalleState>;

/** Importes ya calculados de la cotización (auditoría 2026-08-18, punto 7). */
export interface CotizacionDetalleTotales {
  tasaIva: number;
  conceptosVentaUSD: DetalleState["conceptosVentaUSD"];
  conceptosVentaMXN: DetalleState["conceptosVentaMXN"];
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
  conceptosDescartados: number;
}

/** Apertura/cierre de los diálogos de la pantalla. */
export interface CotizacionDetalleDialogos {
  showConvertir: boolean;
  setShowConvertir: (v: boolean) => void;
  enviarOpen: boolean;
  setEnviarOpen: (v: boolean) => void;
}

/** Acciones y estado de formulario que expone el controlador de la pantalla. */
export interface CotizacionDetalleAccionesProps {
  clienteForm: DetalleState["clienteForm"];
  setClienteForm: DetalleState["setClienteForm"];
  handleCambiarEstado: DetalleState["handleCambiarEstado"];
  abrirDialogConvertir: DetalleState["abrirDialogConvertir"];
  handleConvertir: DetalleState["handleConvertir"];
  convertirProspecto: DetalleState["convertirProspecto"];
  navigate: DetalleState["navigate"];
  /** Flujo de confirmación al aceptar (cierra la oportunidad como Ganada). */
  aceptar: DetalleState["aceptar"];
}

export interface CotizacionDetalleContenidoProps {
  cotizacion: NonNullable<DetalleState["cotizacion"]>;
  id: string;
  canEdit: boolean;
  effectiveRole: AppRole | null;
  embarquesVinculados: DetalleState["embarquesVinculados"];
  envios: EnvioRow[];
  totales: CotizacionDetalleTotales;
  dialogos: CotizacionDetalleDialogos;
  acciones: CotizacionDetalleAccionesProps;
}
