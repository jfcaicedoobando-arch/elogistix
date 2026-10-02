/**
 * /crm/reportes — Tableros de reportes dinámicos (Fase 7).
 * Todos los usuarios del CRM los consultan; sólo el súper administrador
 * crea tableros y reportes.
 */
import { useMemo, useState } from "react";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyState from "@/components/empty/EmptyState";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import {
  useCrearTablero,
  useEliminarReporte,
  useEliminarTablero,
  useGuardarReporte,
  useRenombrarTablero,
  useReportesDeTablero,
  useTablerosCrm,
} from "@/features/crm/hooks/useReportesCrm";
import type { CrmReporteRow } from "@/features/crm/services/reportes/tiposReportes";
import { TarjetaReporte } from "@/features/crm/components/reportes/TarjetaReporte";
import { TableroDialog } from "@/features/crm/components/reportes/TableroDialog";
import { ReporteEditorDialog } from "@/features/crm/components/reportes/ReporteEditorDialog";

export default function CrmReportes() {
  useDocumentTitle("Reportes del CRM");
  const { isSuperAdmin } = usePermissions();
  const { data: tableros = [], isLoading } = useTablerosCrm();
  const [tableroId, setTableroId] = useState<string | null>(null);
  const activoId = tableroId ?? tableros[0]?.id ?? null;
  const activo = useMemo(() => tableros.find((t) => t.id === activoId) ?? null, [tableros, activoId]);
  const { data: reportes = [] } = useReportesDeTablero(activoId);

  const [dlgTablero, setDlgTablero] = useState<{ open: boolean; tablero: { id: string; nombre: string } | null }>({ open: false, tablero: null });
  const [dlgReporte, setDlgReporte] = useState<{ open: boolean; reporte: CrmReporteRow | null }>({ open: false, reporte: null });
  const [borrarTablero, setBorrarTablero] = useState(false);
  const [borrarReporte, setBorrarReporte] = useState<CrmReporteRow | null>(null);

  const mCrear = useCrearTablero();
  const mRenombrar = useRenombrarTablero();
  const mBorrarTablero = useEliminarTablero();
  const mGuardar = useGuardarReporte();
  const mBorrarReporte = useEliminarReporte();

  const guardarTablero = (nombre: string) => {
    const t = dlgTablero.tablero;
    if (t) {
      mRenombrar.mutate({ id: t.id, nombre }, { onSuccess: () => setDlgTablero({ open: false, tablero: null }) });
    } else {
      mCrear.mutate(nombre, { onSuccess: () => setDlgTablero({ open: false, tablero: null }) });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<BarChart3 className="h-6 w-6 text-primary" />}
        title="Reportes"
        description="Tableros con reportes dinámicos del CRM. Los datos se calculan al momento."
        actions={
          isSuperAdmin ? (
            <div className="flex items-center gap-2">
              {activo && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDlgTablero({ open: true, tablero: activo })}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Renombrar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBorrarTablero(true)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
                  </Button>
                  <Button size="sm" onClick={() => setDlgReporte({ open: true, reporte: null })}>
                    <Plus className="mr-1.5 h-4 w-4" /> Agregar reporte
                  </Button>
                </>
              )}
              <Button variant={activo ? "outline" : "default"} size="sm" onClick={() => setDlgTablero({ open: true, tablero: null })}>
                <Plus className="mr-1.5 h-4 w-4" /> Nuevo tablero
              </Button>
            </div>
          ) : undefined
        }
      />

      {isLoading && <p className="py-12 text-center text-body text-muted-foreground">Cargando tableros…</p>}

      {!isLoading && tableros.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="Aún no hay tableros"
          description={isSuperAdmin ? "Crea el primero y agrega reportes con las gráficas que necesites." : "Cuando el administrador cree un tablero, aparecerá aquí."}
          primaryAction={isSuperAdmin ? { label: "Crear tablero", onClick: () => setDlgTablero({ open: true, tablero: null }) } : undefined}
        />
      )}

      {tableros.length > 0 && (
        <>
          <Tabs value={activoId ?? undefined} onValueChange={setTableroId}>
            <TabsList>
              {tableros.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>{t.nombre}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {reportes.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Este tablero no tiene reportes"
              description={isSuperAdmin ? "Agrega el primero con el botón de arriba." : "Pide al administrador que agregue reportes."}
            />
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reportes.map((r) => (
                <TarjetaReporte
                  key={r.id}
                  reporte={r}
                  canEdit={isSuperAdmin}
                  onEditar={(rep) => setDlgReporte({ open: true, reporte: rep })}
                  onEliminar={setBorrarReporte}
                />
              ))}
            </div>
          )}
        </>
      )}

      <TableroDialog
        open={dlgTablero.open}
        onOpenChange={(open) => setDlgTablero((p) => ({ ...p, open }))}
        tablero={dlgTablero.tablero}
        guardando={mCrear.isPending || mRenombrar.isPending}
        onGuardar={guardarTablero}
      />
      {activoId && (
        <ReporteEditorDialog
          open={dlgReporte.open}
          onOpenChange={(open) => setDlgReporte((p) => ({ ...p, open }))}
          reporte={dlgReporte.reporte}
          guardando={mGuardar.isPending}
          onGuardar={(input) =>
            mGuardar.mutate(
              { id: dlgReporte.reporte?.id, tableroId: activoId, input },
              { onSuccess: () => setDlgReporte({ open: false, reporte: null }) },
            )
          }
        />
      )}
      <ConfirmActionDialog
        open={borrarTablero}
        onOpenChange={setBorrarTablero}
        title="Eliminar tablero"
        description={`Se eliminará «${activo?.nombre ?? ""}» con todos sus reportes. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={mBorrarTablero.isPending}
        onConfirm={() =>
          activoId &&
          mBorrarTablero.mutate(activoId, {
            onSuccess: () => {
              setBorrarTablero(false);
              setTableroId(null);
            },
          })
        }
      />
      <ConfirmActionDialog
        open={borrarReporte !== null}
        onOpenChange={(open) => !open && setBorrarReporte(null)}
        title="Eliminar reporte"
        description={`Se eliminará «${borrarReporte?.nombre ?? ""}» del tablero.`}
        confirmLabel="Eliminar"
        variant="destructive"
        isPending={mBorrarReporte.isPending}
        onConfirm={() => borrarReporte && mBorrarReporte.mutate(borrarReporte.id, { onSuccess: () => setBorrarReporte(null) })}
      />
    </PageContainer>
  );
}
