import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error al crear"),
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarDemoraVenta(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Tarifa eliminada"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Error al eliminar"),
  });
  return { crear, eliminar };
}
