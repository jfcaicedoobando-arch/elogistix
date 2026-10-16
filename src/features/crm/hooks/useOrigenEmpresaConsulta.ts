import { useQuery, useQueryClient } from "@tanstack/react-query";
import { crm } from "@/features/crm/queryKeys";
import { fetchOrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";
import type { OrigenEmpresa } from "@/features/crm/services/origenEmpresaCrm";

function resultado(datos?: OrigenEmpresa) {
  if (!datos) return { origen: null, motivo: null, clienteNoDisponible: false };
  if (datos.ok) return { origen: datos.origen, motivo: null, clienteNoDisponible: false };
  return { origen: null, motivo: datos.motivo, clienteNoDisponible: !!datos.clienteId };
}

/** El caché no autoriza el alta mientras se está verificando de nuevo. */
export function useOrigenEmpresaConsulta(empresaId: string | null, activo: boolean) {
  const qc = useQueryClient();
  const queryKey = crm.origenEmpresa(empresaId ?? "");
  const q = useQuery({
    queryKey,
    queryFn: () => fetchOrigenEmpresa(empresaId!),
    enabled: activo && !!empresaId,
    staleTime: 0,
    retry: false,
  });
  const estado = !activo || !empresaId ? "inactiva"
    : q.isPending || q.fetchStatus !== "idle" ? "pendiente" : q.isError ? "error" : "lista";
  // También consulta el estado actual al enviar: un refetch puede empezar
  // antes de que React publique el siguiente render del observador.
  const datosListos = () => {
    const estado = qc.getQueryState(queryKey);
    return activo && empresaId && estado?.status === "success" && estado.fetchStatus === "idle"
      ? qc.getQueryData<OrigenEmpresa>(queryKey) : undefined;
  };
  return {
    listo: estado === "lista", cargando: estado === "pendiente", error: estado === "error",
    datosListos,
    ...resultado(estado === "lista" ? q.data : undefined),
    mensaje: estado === "pendiente" ? "Consultando el origen de la empresa…"
      : estado === "error" ? "No se pudo consultar el origen de la empresa. Reintenta antes de crear."
      : null,
    reintentar: () => { void q.refetch(); },
  };
}

export type OrigenEmpresaConsulta = ReturnType<typeof useOrigenEmpresaConsulta>;
