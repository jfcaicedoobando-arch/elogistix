/**
 * Diálogos de /crm/reportes: alta/renombrado de tablero, editor de reporte
 * y confirmaciones de borrado. Extraídos de la ruta para bajar su complejidad.
 */
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import {
  useCrearTablero,
  useEliminarReporte,
  useEliminarTablero,
  useGuardarReporte,
  useRenombrarTablero,
} from "@/features/crm/hooks/useReportesCrm";
import type { CrmReporteRow } from "@/features/crm/services/reportes/tiposReportes";
import { TableroDialog } from "./TableroDialog";
import { ReporteEditorDialog } from "./ReporteEditorDialog";

export interface DlgTableroState { open: boolean; tablero: { id: string; nombre: string } | null }
export interface DlgReporteState { open: boolean; reporte: CrmReporteRow | null }

interface Props {
  activoId: string | null;
  activoNombre: string;
  dlgTablero: DlgTableroState;
  setDlgTablero: (fn: (p: DlgTableroState) => DlgTableroState) => void;
  dlgReporte: DlgReporteState;
  setDlgReporte: (fn: (p: DlgReporteState) => DlgReporteState) => void;
  borrarTablero: boolean;
  setBorrarTablero: (v: boolean) => void;
  borrarReporte: CrmReporteRow | null;
  setBorrarReporte: (r: CrmReporteRow | null) => void;
  onTableroEliminado: () => void;
}

export function ReportesDialogs(p: Props) {
  const mCrear = useCrearTablero();
  const mRenombrar = useRenombrarTablero();
  const mBorrarTablero = useEliminarTablero();
  const mGuardar = useGuardarReporte();
  const mBorrarReporte = useEliminarReporte();

  const cerrarTablero = () => p.setDlgTablero(() => ({ open: false, tablero: null }));
  const guardarTablero = (nombre: string) => {
    const t = p.dlgTablero.tablero;
    if (t) mRenombrar.mutate({ id: t.id, nombre }, { onSuccess: cerrarTablero });
    else mCrear.mutate(nombre, { onSuccess: cerrarTablero });
  };

  return (
    <>
      <TableroDialog
        open={p.dlgTablero.open}
        onOpenChange={(open) => p.setDlgTablero((prev) => ({ ...prev, open }))}
        tablero={p.dlgTablero.tablero}
        guardando={mCrear.isPending || mRenombrar.isPending}
        onGuardar={guardarTablero}
      />
      {p.activoId && (
        <ReporteEditorDialog
          open={p.dlgReporte.open}
          onOpenChange={(open) => p.setDlgReporte((prev) => ({ ...prev, open }))}
          reporte={p.dlgReporte.reporte}
          guardando={mGuardar.isPending}
          onGuardar={(input) =>
            mGuardar.mutate(
              { id: p.dlgReporte.reporte?.id, tableroId: p.activoId as string, input },
              { onSuccess: () => p.setDlgReporte(() => ({ open: false, reporte: null })) },
            )
          }
        />
      )}
      <ConfirmActionDialog
        open={p.borrarTablero}
        onOpenChange={p.setBorrarTablero}
        title="Eliminar tablero"
        description={`Se eliminará «${p.activoNombre}» con todos sus reportes. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={mBorrarTablero.isPending}
        onConfirm={() => {
          if (!p.activoId) return;
          mBorrarTablero.mutate(p.activoId, {
            onSuccess: () => {
              p.setBorrarTablero(false);
              p.onTableroEliminado();
            },
          });
        }}
      />
      <ConfirmActionDialog
        open={p.borrarReporte !== null}
        onOpenChange={(open) => !open && p.setBorrarReporte(null)}
        title="Eliminar reporte"
        description={`Se eliminará «${p.borrarReporte?.nombre ?? ""}» del tablero.`}
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={mBorrarReporte.isPending}
        onConfirm={() => {
          if (!p.borrarReporte) return;
          mBorrarReporte.mutate(p.borrarReporte.id, { onSuccess: () => p.setBorrarReporte(null) });
        }}
      />
    </>
  );
}
