import { ArrowLeft, ArrowRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useDialogGenerarProformaController } from "../../hooks/useDialogGenerarProformaController";

type Controller = ReturnType<typeof useDialogGenerarProformaController>;

export function ProformaDialogFooter({ c, onClose }: { c: Controller; onClose: () => void }) {
  if (c.paso === "seleccion") return <>
    <Button variant="outline" onClick={onClose}>Cancelar</Button>
    <Button onClick={() => c.setPaso("confirmacion")} disabled={c.totalSeleccionados === 0 || c.pendientesIva.length > 0}>
      Revisar Proforma <ArrowRight className="h-4 w-4 ml-2" />
    </Button>
  </>;
  return <>
    <Button variant="outline" onClick={() => c.creada ? onClose() : c.setPaso("seleccion")} disabled={c.isPending}>
      {c.creada ? "Cerrar" : <><ArrowLeft className="h-4 w-4 mr-2" /> Volver</>}
    </Button>
    <Button onClick={c.handleConfirmar} disabled={c.isPending || (!c.creada && c.pendientesIva.length > 0)} loading={c.isPending}>
      {c.isPending ? "Generando…" : <><FileSpreadsheet className="h-4 w-4 mr-2" /> {c.creada ? "Reintentar descarga del PDF" : "Confirmar y Generar"}</>}
    </Button>
  </>;
}
