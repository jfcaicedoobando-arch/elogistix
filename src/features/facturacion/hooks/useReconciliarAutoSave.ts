import { useEffect, useRef, useState } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/lib/ui/appFeedback";
import { fetchFacturaById } from "../services/detail";
import { encolarAutoSave } from "./colaAutoSaveDatosFiscales";

/** Al volver durante un envío, la nueva instancia lee con su propio scope.
 * La lectura también bloquea Timbrar hasta conciliar sus campos, o reintentar.
 */
export function useReconciliarAutoSave(qc: QueryClient, facturaId: string, organizationId: string, authScope: ReturnType<typeof captureAuthOperationScope>) {
  const mutationKey = queryKeys.facturacion.autosaveDatosTimbrado(facturaId, organizationId);
  const iniciado = useRef(false);
  const [necesario] = useState(() => qc.isMutating({ mutationKey }) > 0);
  const { mutate, isPending, isError } = useMutation({
    mutationKey, networkMode: "always", retry: false, gcTime: 0,
    // La lectura usa la misma cola: una escritura nueva no puede adelantar
    // al GET y quedar después sobrescrita por su snapshot anterior.
    mutationFn: () => encolarAutoSave(qc, `${organizationId}:${facturaId}`, async () => {
      authScope.assertCurrent();
      const key = queryKeys.facturas.detail(facturaId);
      await qc.cancelQueries({ queryKey: key });
      authScope.assertCurrent();
      const factura = await fetchFacturaById(facturaId);
      authScope.assertCurrent();
      if (!factura || factura.organization_id !== organizationId) throw new Error("No se pudo recuperar el borrador de esta empresa.");
      qc.setQueryData(key, factura);
      return { patch: Object.fromEntries(Object.entries({ uso_cfdi: factura.uso_cfdi, forma_pago: factura.forma_pago, metodo_pago: factura.metodo_pago }).filter(([, value]) => value !== null)) };
    }),
    onError: (error) => {
      if (authScope.isCurrent()) notifyError(undefined, { title: "No se pudieron recuperar los datos fiscales", error,
        method: "FACTURA_DATOS_FISCALES_RECONCILIAR", context: { facturaId, organizationId } });
    },
  });
  useEffect(() => { if (necesario && !iniciado.current) { iniciado.current = true; mutate(); } }, [necesario, mutate]);
  return { isPending, isError, reintentar: () => { if (isError && authScope.isCurrent()) mutate(); } };
}
