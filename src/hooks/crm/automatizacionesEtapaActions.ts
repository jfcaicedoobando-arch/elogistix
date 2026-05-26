/**
 * Re-export del servicio para retro-compatibilidad. La lógica e I/O viven
 * en `src/services/crm/automatizacionesEtapa.ts`.
 */
export {
  fetchEtapa,
  fetchOportunidad,
  notifyVendedorMovido,
  crearTareaGanada,
  cancelarActividadesPerdida,
  crearTareaSeguimiento,
  type EtapaInfo,
  type OportunidadMin,
  type AutomationCtx,
} from "@/services/crm/automatizacionesEtapa";
