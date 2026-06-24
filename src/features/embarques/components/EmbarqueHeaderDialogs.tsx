/**
 * Diálogos del header de detalle de embarque:
 *   - Soft warning de cierre sin proforma.
 *   - Soft warning de avance con docs faltantes (estados tempranos).
 *   - Hard block de avance con docs faltantes (estados avanzados).
 *
 * Extraído de `EmbarqueDetalleHeader.tsx` para respetar el límite de 200 líneas.
 */
import { AlertTriangle, FileWarning } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  siguienteEstado: string | null;
  // Cierre sin proforma
  warnCierreOpen: boolean;
  onWarnCierreOpenChange: (open: boolean) => void;
  onConfirmarCierreSinProforma: () => void;
  conceptosSinProforma: number;
  // Docs faltantes
  docsFaltantes: string[];
  warnDocsOpen: boolean;
  onWarnDocsOpenChange: (open: boolean) => void;
  blockDocsOpen: boolean;
  onBlockDocsOpenChange: (open: boolean) => void;
  onConfirmarAvanceConDocsPendientes: () => void;
  onIrADocumentos: () => void;
}

export function EmbarqueHeaderDialogs({
  siguienteEstado,
  warnCierreOpen, onWarnCierreOpenChange, onConfirmarCierreSinProforma, conceptosSinProforma,
  docsFaltantes,
  warnDocsOpen, onWarnDocsOpenChange,
  blockDocsOpen, onBlockDocsOpenChange,
  onConfirmarAvanceConDocsPendientes, onIrADocumentos,
}: Props) {
  return (
    <>
      <AlertDialog open={warnCierreOpen} onOpenChange={onWarnCierreOpenChange}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay conceptos sin facturar</AlertDialogTitle>
            <AlertDialogDescription>
              Este embarque tiene <strong>{conceptosSinProforma}</strong> concepto(s) de venta sin proforma generada. Si lo cierras ahora tendrás que pedirle a un administrador que lo reabra para poder facturar. ¿Cerrar de todas formas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmarCierreSinProforma}>Cerrar de todas formas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={warnDocsOpen} onOpenChange={onWarnDocsOpenChange}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Faltan documentos
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Aún no se han cargado los siguientes documentos para pasar a <strong>{siguienteEstado}</strong>:</p>
                <ul className="list-disc list-inside text-sm">
                  {docsFaltantes.map((d) => <li key={d}>{d}</li>)}
                </ul>
                <p>Puedes continuar y subirlos más tarde. ¿Avanzar de todos modos?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmarAvanceConDocsPendientes}>Avanzar de todos modos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockDocsOpen} onOpenChange={onBlockDocsOpenChange}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-destructive" /> No se puede avanzar
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Para pasar a <strong>{siguienteEstado}</strong> es obligatorio tener cargados (o marcados como "No aplica") estos documentos:</p>
                <ul className="list-disc list-inside text-sm">
                  {docsFaltantes.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction onClick={onIrADocumentos}>Ir a Documentos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
