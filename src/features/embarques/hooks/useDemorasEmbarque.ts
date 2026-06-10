import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calcularDemorasEmbarque, eliminarDemorasAuto } from "../services/demorasEmbarque";

export function useRecalcularDemoras(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => calcularDemorasEmbarque(embarqueId!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["embarque-detalle", embarqueId] });
      qc.invalidateQueries({ queryKey: ["conceptos-venta", embarqueId] });
      qc.invalidateQueries({ queryKey: ["conceptos-costo", embarqueId] });
      if (data.sin_eventos) {
        toast.warning("Faltan eventos de Descarga o Entrega en el timeline");
      } else if (data.dias_excedidos === 0) {
        toast.info("No hay días excedidos: no se generaron demoras");
      } else {
        toast.success(`Demoras calculadas: ${data.dias_excedidos} días excedidos`);
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al calcular demoras";
      toast.error(msg);
    },
  });
}

export function useEliminarDemorasAuto(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => eliminarDemorasAuto(embarqueId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["embarque-detalle", embarqueId] });
      qc.invalidateQueries({ queryKey: ["conceptos-venta", embarqueId] });
      qc.invalidateQueries({ queryKey: ["conceptos-costo", embarqueId] });
      toast.success("Demoras automáticas eliminadas");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      toast.error(msg);
    },
  });
}
