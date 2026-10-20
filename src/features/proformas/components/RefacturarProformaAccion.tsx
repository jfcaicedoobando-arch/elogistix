/**
 * Aviso + acción «Refacturar desde esta proforma» cuando su factura fue
 * cancelada. Crea una proforma nueva en borrador y cancela la anterior.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  facturaCanceladaDeProforma, refacturarProforma,
} from "@/features/proformas/services/refacturar";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  proformaId: string;
  numero: string;
  habilitada: boolean;
}

export function RefacturarProformaAccion({ proformaId, numero, habilitada }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: facturaNum } = useQuery({
    queryKey: ["proforma-factura-cancelada", proformaId],
    queryFn: () => facturaCanceladaDeProforma(proformaId),
    enabled: habilitada,
  });
  const mutation = useMutation({
    mutationFn: () => refacturarProforma(proformaId),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      notifySuccess(undefined, {
        title: `Se creó la proforma ${r.nuevo_numero}`,
        description: `${r.anterior_numero} quedó cancelada como historial.`,
      });
      setOpen(false);
      navigate(`/proformas/${r.nueva_proforma_id}`);
    },
    onError: (err: unknown) => {
      notifyError(undefined, {
        title: "No se pudo refacturar la proforma",
        description: getErrorMessage(err),
        error: err,
        method: "REFACTURAR_PROFORMA",
      });
    },
  });

  if (!habilitada || !facturaNum) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
      <p className="text-body-sm">
        La factura {facturaNum} de esta proforma fue cancelada. Puedes crear una proforma nueva
        con los mismos conceptos para emitir la factura corregida.
      </p>
      <Button size="sm" onClick={() => setOpen(true)}>
        <RefreshCw className="mr-2 h-4 w-4" /> Refacturar desde esta proforma
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refacturar {numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Se creará una proforma nueva en borrador con los mismos conceptos y montos, que
              podrás corregir y deberá aprobarse como cualquier proforma. {numero} pasará a
              Cancelada y se conservará como historial de la factura {facturaNum}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
            >
              {mutation.isPending ? "Creando…" : "Crear proforma nueva"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
