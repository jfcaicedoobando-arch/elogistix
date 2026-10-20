/**
 * Aviso + acción «Refacturar desde esta proforma» cuando su factura fue
 * cancelada. Cancela la anterior y abre la proforma nueva en el embarque,
 * con los mismos conceptos y la nota de linaje, lista para editarse.
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  facturaCanceladaDeProforma, refacturarProforma, type RefacturacionNavState,
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
  const { data: facturaNum } = useQuery({
    queryKey: ["proforma-factura-cancelada", proformaId],
    queryFn: () => facturaCanceladaDeProforma(proformaId),
    enabled: habilitada,
  });
  if (!habilitada || !facturaNum) return null;
  return <AvisoRefacturar proformaId={proformaId} numero={numero} facturaNum={facturaNum} />;
}

function AvisoRefacturar({ proformaId, numero, facturaNum }: {
  proformaId: string; numero: string; facturaNum: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => refacturarProforma(proformaId),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      await qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta() });
      await qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
      notifySuccess(undefined, {
        title: `${r.anterior_numero} quedó cancelada`,
        description: "Revisa los conceptos y genera la proforma nueva.",
      });
      setOpen(false);
      const state: RefacturacionNavState = {
        refacturacion: {
          conceptoIds: r.conceptos, notas: r.notas_sugeridas, anteriorNumero: r.anterior_numero,
        },
      };
      navigate(`/embarques/${r.embarque_id}?tab=facturacion`, { state });
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
              {numero} pasará a Cancelada y se conservará como historial de la factura {facturaNum}.
              Enseguida se abrirá la proforma nueva con los mismos conceptos para que la revises
              y corrijas antes de crearla; después deberá aprobarse como cualquier proforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
            >
              {mutation.isPending ? "Preparando…" : "Continuar a la proforma nueva"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
