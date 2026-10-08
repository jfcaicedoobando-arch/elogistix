import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./index";

/** Las facturas pueden repartirse entre embarques; su cabecera no basta. */
function esLecturaSeguroFactura(key: QueryKey): boolean {
  const embarqueId = key[1];
  if (typeof embarqueId !== "string" || !embarqueId) return false;
  const prefixes = [
    queryKeys.embarques.pnlFinanciero(embarqueId),
    queryKeys.embarques.seguros(embarqueId),
  ];
  return prefixes.some((prefix) => prefix.every((part, i) => key[i] === part));
}

/**
 * Refresca P&L, pólizas y selector después de cambiar sus documentos fuente.
 * Conserva las keys existentes y el resto de las invalidaciones del llamador.
 * Sólo alcanza estas familias ya cacheadas, sin inferir asignaciones por header
 * ni crear consultas de otros embarques. No modifica datos financieros.
 */
export function invalidateSeguroFacturaDependencies(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ predicate: ({ queryKey }) => esLecturaSeguroFactura(queryKey) });
}
