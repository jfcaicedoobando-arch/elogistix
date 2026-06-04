import { useState } from "react";
import { ShieldAlert, RefreshCw, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditoriaEjecutivoTab } from "@/components/auditoria/AuditoriaEjecutivoTab";
import { AuditoriaHallazgosTab } from "@/components/auditoria/AuditoriaHallazgosTab";
import { AuditoriaPorReglaTab } from "@/components/auditoria/AuditoriaPorReglaTab";
import { useAuditoriaPageController } from "@/hooks/auditoria";
import { useAuditoriaEjecutivo } from "@/hooks/auditoria";
import { usePermissions } from "@/hooks/shared";
import type { UseHallazgosTablaStateOptions } from "@/hooks/auditoria";
import { exportHallazgosCsv } from "@/lib/domain/auditoriaCsv";

type TabId = "ejecutivo" | "tabla" | "por_regla";

export default function Auditoria() {
  const c = useAuditoriaPageController();
  const ejecutivo = useAuditoriaEjecutivo();
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState<TabId>(isAdmin ? "ejecutivo" : "tabla");
  const [drillFilters, setDrillFilters] = useState<UseHallazgosTablaStateOptions>({});
  const [tablaKey, setTablaKey] = useState(0);

  const handleDrillDown = (filtro: {
    severidad?: "critico" | "alto" | "medio";
    cliente?: string;
    etapa?: string;
    soloVencidos?: boolean;
    responsable?: "todos" | "mios" | "sin_asignar" | "vencidos";
  }) => {
    setDrillFilters({
      initialSeveridad: filtro.severidad,
      initialCliente: filtro.cliente,
      initialSearch: filtro.etapa,
      soloVencidos: filtro.soloVencidos,
      initialResponsable: filtro.responsable,
    });
    setTablaKey((k) => k + 1);
    setTab("tabla");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Auditoría operativa"
        description="Salud operativa, hallazgos y acciones pendientes detectadas en los embarques."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportHallazgosCsv(c.hallazgosFiltrados)}
              disabled={c.isLoading || c.hallazgosFiltrados.length === 0}
              title="Exportar la lista filtrada a CSV"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={c.handleRecalcular} disabled={c.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${c.isFetching ? "animate-spin" : ""}`} />
              Recalcular
            </Button>
          </div>
        }
      />

      {c.generadoEn && (
        <div className="text-xs text-muted-foreground">
          Reporte generado: <span className="tabular-nums">{c.generadoEn}</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="ejecutivo">Resumen ejecutivo</TabsTrigger>
          <TabsTrigger value="tabla">Hallazgos</TabsTrigger>
          <TabsTrigger value="por_regla">Por regla</TabsTrigger>
        </TabsList>

        <TabsContent value="ejecutivo" className="mt-0">
          <AuditoriaEjecutivoTab data={ejecutivo} onDrillDown={handleDrillDown} />
        </TabsContent>

        <TabsContent value="tabla" className="mt-0 space-y-4">
          <AuditoriaHallazgosTab c={c} drillFilters={drillFilters} tablaKey={tablaKey} />
        </TabsContent>

        <TabsContent value="por_regla" className="mt-0">
          <AuditoriaPorReglaTab c={c} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
