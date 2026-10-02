/**
 * /crm/reportes — Tableros de reportes dinámicos (Fase 7).
 * Todos los usuarios del CRM los consultan; sólo el súper administrador
 * crea tableros y reportes. Los diálogos viven en `ReportesDialogs`.
 */
import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import EmptyState from "@/components/empty/EmptyState";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { useReportesDeTablero, useTablerosCrm } from "@/features/crm/hooks/useReportesCrm";
import type { CrmReporteRow } from "@/features/crm/services/reportes/tiposReportes";
import { TableroAcciones } from "@/features/crm/components/reportes/TableroAcciones";
import { TableroContenido } from "@/features/crm/components/reportes/TableroContenido";
import { ReportesDialogs, type DlgReporteState, type DlgTableroState } from "@/features/crm/components/reportes/ReportesDialogs";

export default function CrmReportes() {
  useDocumentTitle("Reportes del CRM");
  const { isSuperAdmin } = usePermissions();
  const { data: tableros = [], isLoading } = useTablerosCrm();
  const [tableroId, setTableroId] = useState<string | null>(null);
  const activoId = tableroId ?? tableros[0]?.id ?? null;
  const activo = useMemo(() => tableros.find((t) => t.id === activoId) ?? null, [tableros, activoId]);
  const { data: reportes = [] } = useReportesDeTablero(activoId);

  const [dlgTablero, setDlgTablero] = useState<DlgTableroState>({ open: false, tablero: null });
  const [dlgReporte, setDlgReporte] = useState<DlgReporteState>({ open: false, reporte: null });
  const [borrarTablero, setBorrarTablero] = useState(false);
  const [borrarReporte, setBorrarReporte] = useState<CrmReporteRow | null>(null);

  const nuevoTablero = () => setDlgTablero({ open: true, tablero: null });

  return (
    <PageContainer>
      <PageHeader
        icon={<BarChart3 className="h-6 w-6 text-primary" />}
        title="Reportes"
        description="Tableros con reportes dinámicos del CRM. Los datos se calculan al momento."
        actions={
          isSuperAdmin ? (
            <TableroAcciones
              tableroActivo={activo}
              onNuevoTablero={nuevoTablero}
              onRenombrar={() => activo && setDlgTablero({ open: true, tablero: activo })}
              onEliminar={() => setBorrarTablero(true)}
              onAgregarReporte={() => setDlgReporte({ open: true, reporte: null })}
            />
          ) : undefined
        }
      />

      {isLoading && <p className="py-12 text-center text-body text-muted-foreground">Cargando tableros…</p>}

      {!isLoading && tableros.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="Aún no hay tableros"
          description={isSuperAdmin ? "Crea el primero y agrega reportes con las gráficas que necesites." : "Cuando el administrador cree un tablero, aparecerá aquí."}
          primaryAction={isSuperAdmin ? { label: "Crear tablero", onClick: nuevoTablero } : undefined}
        />
      )}

      {tableros.length > 0 && (
        <TableroContenido
          tableros={tableros}
          activoId={activoId}
          reportes={reportes}
          isSuperAdmin={isSuperAdmin}
          onSeleccionarTablero={setTableroId}
          onEditarReporte={(rep) => setDlgReporte({ open: true, reporte: rep })}
          onEliminarReporte={setBorrarReporte}
        />
      )}

      <ReportesDialogs
        activoId={activoId}
        activoNombre={activo?.nombre ?? ""}
        dlgTablero={dlgTablero}
        setDlgTablero={setDlgTablero}
        dlgReporte={dlgReporte}
        setDlgReporte={setDlgReporte}
        borrarTablero={borrarTablero}
        setBorrarTablero={setBorrarTablero}
        borrarReporte={borrarReporte}
        setBorrarReporte={setBorrarReporte}
        onTableroEliminado={() => setTableroId(null)}
      />
    </PageContainer>
  );
}
