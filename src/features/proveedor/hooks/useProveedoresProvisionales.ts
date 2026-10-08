import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  aprobarProveedorProvisional,
  fetchProveedoresProvisionales,
} from "@/features/proveedor/services/altaProvisional";

export function useProveedoresProvisionales() {
  return useQuery({
    queryKey: queryKeys.proveedores.provisionales(),
    queryFn: fetchProveedoresProvisionales,
    staleTime: 60_000,
  });
}

export function useAprobarProveedorProvisional(proveedorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aprobarProveedorProvisional(proveedorId),
    onSuccess: () => {
      // El prefijo canónico incluye listas, provisionales y detalle por id.
      qc.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Proveedor aprobado." });
    },
    onError: (e: unknown) => notifyError(undefined, {
      title: "No se pudo aprobar",
      description: e instanceof Error ? e.message : "Completa los datos con Editar y vuelve a intentar.",
      error: e,
      method: "FEATURES_PROVEEDOR_APROBAR_PROVISIONAL_1",
    }),
  });
}
