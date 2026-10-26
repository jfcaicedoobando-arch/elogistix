/**
 * Aviso + acción «Refacturar desde esta proforma» cuando su factura fue
 * cancelada. Crea una proforma nueva en borrador y cancela la anterior.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFacturaCanceladaDeProforma, useRefacturarProforma } from "../hooks/useRefacturarProforma";

interface Props {
  proformaId: string;
  numero: string;
  habilitada: boolean;
}

export function RefacturarProformaAccion({ proformaId, numero, habilitada }: Props) {
  const { data: facturaNum } = useFacturaCanceladaDeProforma(proformaId, habilitada);
  if (!habilitada || !facturaNum) return null;
  return <AvisoRefacturar proformaId={proformaId} numero={numero} facturaNum={facturaNum} />;
}

function AvisoRefacturar({ proformaId, numero, facturaNum }: {
  proformaId: string; numero: string; facturaNum: string;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useRefacturarProforma(proformaId, () => setOpen(false));

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
