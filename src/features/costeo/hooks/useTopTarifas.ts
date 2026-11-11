import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchTopTarifas, type TopTarifasParams } from "@/features/costeo/services/topTarifas";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import {
  agruparTiposContenedorComerciales,
  idsEquivalentesDeTipo,
  resolverIdCanonicoTipo,
} from "@/features/catalogos/utils/tiposContenedorCanonico";

/**
 * UUID genérico (cualquier versión) — validamos formato antes de disparar
 * el RPC para evitar mandar ids vacíos, texto libre o valores no
 * provenientes del catálogo (ver Q-03).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return !!value && UUID_REGEX.test(value);
}

/** Indica si los 3 ids requeridos por `get_top_tarifas` son UUID válidos. */
export function isValidTopTarifasIds(p: Partial<TopTarifasParams>): boolean {
  return (
    isValidUuid(p.puertoOrigenId) &&
    isValidUuid(p.puertoDestinoId) &&
    isValidUuid(p.tipoContenedorId)
  );
}

export function useTopTarifas(p: Partial<TopTarifasParams>) {
  const { organizationId } = useOrganization();
  const catalogo = useTiposContenedor();
  const catalogoListo = catalogo.isSuccess === true;
  // Normalizar fecha: "" (input date vacío) debe tratarse como no proveída,
  // no propagarse al RPC como date inválido (Postgres 22007).
  const fecha = p.fecha && p.fecha.length > 0 ? p.fecha : undefined;
  const idsValidos = isValidTopTarifasIds(p);
  // P1: el tipo elegido puede ser un registro legacy equivalente; buscamos con
  // todos los IDs del grupo. El catálogo debe resolver antes de usar el
  // fallback de ID exacto, reservado para UUID que no están en el catálogo.
  const tiposComerciales = agruparTiposContenedorComerciales(catalogo.data ?? []);
  const tipoCanonico = resolverIdCanonicoTipo(tiposComerciales, p.tipoContenedorId);
  const tipoContenedorIds = catalogoListo
    ? idsEquivalentesDeTipo(tiposComerciales, p.tipoContenedorId)
    : [];
  const puedeConsultar = !!organizationId && idsValidos;
  const enabled = puedeConsultar && catalogoListo;
  const query = useQuery({
    queryKey: queryKeys.costeo.tarifas.top({
      organizationId,
      puertoOrigenId: p.puertoOrigenId,
      puertoDestinoId: p.puertoDestinoId,
      tipoContenedorId: tipoCanonico,
      tipoContenedorIds,
      fecha,
    }),
    queryFn: () =>
      fetchTopTarifas({
        puertoOrigenId: p.puertoOrigenId!,
        puertoDestinoId: p.puertoDestinoId!,
        tipoContenedorId: tipoCanonico,
        tipoContenedorIds,
        fecha,
        organizationId: organizationId!,
      }),
    enabled,
    staleTime: 60 * 1000,
  });
  const resultado = catalogoListo ? query : catalogo;
  return {
    data: enabled ? query.data : undefined,
    error: puedeConsultar ? resultado.error : null,
    isError: puedeConsultar && resultado.isError,
    isSuccess: enabled && query.isSuccess,
    isFetching: puedeConsultar && (resultado.isFetching || catalogo.isPending),
    isRefetching: puedeConsultar && resultado.isRefetching,
    refetch: resultado.refetch,
    idsValidos,
    tipoContenedorIds,
  };
}

