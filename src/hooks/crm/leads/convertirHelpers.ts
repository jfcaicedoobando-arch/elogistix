/**
 * Re-export del servicio. Mantengo este archivo por compatibilidad con
 * código existente que importe los helpers de conversión desde aquí.
 * La lógica vive en `src/services/crm/leads.ts`.
 */
export {
  resolveClienteForConversion,
  fetchPrimeraEtapaAbierta,
  type ResolveClienteParams,
} from "@/services/crm/leads";
