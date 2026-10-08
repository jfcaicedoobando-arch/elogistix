/** Botón "Aprobar como proveedor" para Contabilidad (proveedores provisionales). */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { aprobarProveedorProvisional } from "@/features/proveedor/services/altaProvisional";

export function AprobarProveedorButton({ proveedorId }: { proveedorId: string }) {
  const qc = useQueryClient();
  const aprobar = useMutation({
    mutationFn: () => aprobarProveedorProvisional(proveedorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      qc.invalidateQueries({ queryKey: ["proveedor"] });
      notifySuccess(undefined, { title: "Proveedor aprobado." });
    },
    onError: (e: unknown) => notifyError(undefined, {
      title: "No se pudo aprobar",
      description: e instanceof Error ? e.message : "Completa los datos con Editar y vuelve a intentar.",
      error: e,
      method: "FEATURES_PROVEEDOR_APROBAR_PROVISIONAL_1",
    }),
  });
  return (
    <Button size="sm" variant="outline" disabled={aprobar.isPending} onClick={() => aprobar.mutate()}>
      <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar como proveedor
    </Button>
  );
}
