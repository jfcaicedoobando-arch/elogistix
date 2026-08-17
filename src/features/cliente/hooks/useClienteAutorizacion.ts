/**
 * v13.624.0 — Política de autorización del cliente ("cliente de casa").
 *
 * Devuelve si el cliente requiere autorizar cotizaciones y/o proformas.
 * Mientras carga se asume `true` (comportamiento conservador: exigir
 * autorización) para no habilitar botones por error.
 */
import { useQuery } from "@tanstack/react-query";
import {
  obtenerAutorizacionCliente,
  type ClienteAutorizacion,
} from "@/features/cliente/services/autorizacionClienteService";

const DEFAULT_AUTORIZACION: ClienteAutorizacion = {
  requiereAutorizacionCotizacion: true,
  requiereAutorizacionProforma: true,
  esClienteDeCasa: false,
};

export function useClienteAutorizacion(clienteId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["cliente-autorizacion", clienteId ?? "none"],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: () => obtenerAutorizacionCliente(clienteId as string),
  });

  return {
    autorizacion: query.data ?? DEFAULT_AUTORIZACION,
    isLoading: query.isLoading,
  };
}
