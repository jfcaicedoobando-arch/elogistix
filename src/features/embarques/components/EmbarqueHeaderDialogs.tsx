/**
 * Diálogos del header de detalle de embarque:
 *   - Soft warning de cierre sin proforma.
 *   - Soft warning de avance con docs faltantes (estados tempranos).
 *   - Hard block de avance con docs faltantes (estados avanzados).
 *   - Hard block de avance sin fecha de llegada real.
 *
 * v13.232.0 · Migrado a `ConfirmActionDialog` (Lote 7d.2).
 */
import { AlertTriangle, FileWarning, CalendarClock } from "lucide-react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

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
  // Fecha de llegada real obligatoria (Arribo)
  blockFechaLlegadaOpen: boolean;
  onBlockFechaLlegadaOpenChange: (open: boolean) => void;
  onIrATracking: () => void;
}

export function EmbarqueHeaderDialogs({
  siguienteEstado,
  warnCierreOpen, onWarnCierreOpenChange, onConfirmarCierreSinProforma, conceptosSinProforma,
  docsFaltantes,
  warnDocsOpen, onWarnDocsOpenChange,
  blockDocsOpen, onBlockDocsOpenChange,
  onConfirmarAvanceConDocsPendientes, onIrADocumentos,
  blockFechaLlegadaOpen, onBlockFechaLlegadaOpenChange, onIrATracking,
}: Props) {
  return (
    <>
      <ConfirmActionDialog
        open={warnCierreOpen}
        onOpenChange={onWarnCierreOpenChange}
        title="Hay conceptos sin facturar"
        confirmLabel="Cerrar de todas formas"
        onConfirm={onConfirmarCierreSinProforma}
        description={
          <>
            Este embarque tiene <strong>{conceptosSinProforma}</strong> concepto(s) de venta sin proforma generada. Si lo cierras ahora tendrás que pedirle a un administrador que lo reabra para poder facturar. ¿Cerrar de todas formas?
          </>
        }
      />

      <ConfirmActionDialog
        open={warnDocsOpen}
        onOpenChange={onWarnDocsOpenChange}
        title="Faltan documentos"
        titleIcon={<AlertTriangle className="h-5 w-5 text-warning" aria-hidden />}
        confirmLabel="Avanzar de todos modos"
        onConfirm={onConfirmarAvanceConDocsPendientes}
        description={
          <div className="space-y-2">
            <p>Aún no se han cargado los siguientes documentos para pasar a <strong>{siguienteEstado}</strong>:</p>
            <ul className="list-disc list-inside text-sm">
              {docsFaltantes.map((d) => <li key={d}>{d}</li>)}
            </ul>
            <p>Puedes continuar y subirlos más tarde. ¿Avanzar de todos modos?</p>
          </div>
        }
      />

      <ConfirmActionDialog
        open={blockDocsOpen}
        onOpenChange={onBlockDocsOpenChange}
        title="No se puede avanzar"
        titleIcon={<FileWarning className="h-5 w-5 text-destructive" aria-hidden />}
        titleDestructive
        confirmLabel="Ir a Documentos"
        cancelLabel="Cerrar"
        onConfirm={onIrADocumentos}
        description={
          <div className="space-y-2">
            <p>Para pasar a <strong>{siguienteEstado}</strong> es obligatorio tener cargados (o marcados como "No aplica") estos documentos:</p>
            <ul className="list-disc list-inside text-sm">
              {docsFaltantes.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        }
      />

      <ConfirmActionDialog
        open={blockFechaLlegadaOpen}
        onOpenChange={onBlockFechaLlegadaOpenChange}
        title="Registra primero la llegada real"
        titleIcon={<CalendarClock className="h-5 w-5 text-destructive" aria-hidden />}
        titleDestructive
        confirmLabel="Ir a Tracking"
        cancelLabel="Cerrar"
        onConfirm={onIrATracking}
        description={
          <>
            Para pasar a <strong>Arribo</strong> debes capturar la fecha de llegada real desde el tab <strong>Tracking</strong> (botón "Marcar Llegada real"). Este dato es obligatorio para calcular puntualidad y demoras.
          </>
        }
      />
    </>
  );
}
