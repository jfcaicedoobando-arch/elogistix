import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  crearDemoraVenta, eliminarDemoraVenta, fetchDemorasVenta,
  type DemoraVentaTarifaInput,
} from "@/features/costeo/services/demorasVenta";

const KEY = ["costeo-demoras-venta"] as const;

export function useDemorasVenta() {
  return useQuery({ queryKey: KEY, queryFn: fetchDemorasVenta });
}

export function useDemorasVentaMutations() {
  const qc = useQueryClient();
  const crear = useMutation({
    mutationFn: (input: DemoraVentaTarifaInput) => crearDemoraVenta(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tarifa creada"); },
    onError: (e: unknown) => notifyError(toast, { title: e instanceof Error ? e.message : "Error al crear", error: e, method: "FEATURES_COSTEO_HOOKS_USEDEMORASVENTA_1" }),
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarDemoraVenta(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tarifa eliminada"); },
    onError: (e: unknown) => notifyError(toast, { title: e instanceof Error ? e.message : "Error al eliminar", error: e, method: "FEATURES_COSTEO_HOOKS_USEDEMORASVENTA_2" }),
  });
  return { crear, eliminar };
}
