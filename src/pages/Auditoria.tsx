import { useState } from "react";
import { ShieldAlert, RefreshCw, Eye, EyeOff, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditoriaKpis } from "@/components/auditoria/AuditoriaKpis";
import { AuditoriaEjecutivoTab } from "@/components/auditoria/AuditoriaEjecutivoTab";
import { HallazgoTabla } from "@/components/auditoria/HallazgoTabla";
import { HallazgosTablaPaginada } from "@/components/auditoria/HallazgosTablaPaginada";
import { useAuditoriaPageController } from "@/hooks/auditoria/useAuditoriaPageController";
import { useAuditoriaEjecutivo } from "@/hooks/auditoria/useAuditoriaEjecutivo";
import { usePermissions } from "@/hooks/shared/usePermissions";
import type { UseHallazgosTablaStateOptions } from "@/hooks/auditoria/useHallazgosTablaState";
import { exportToCsv } from "@/generators/exportCsv";
import type { SeveridadAuditoria } from "@/types/auditoria";
import { REGLA_INFO, REGLAS_ORDEN, reglaShortLabel } from "@/lib/ui/auditoriaConfig";

export default function Auditoria() {
  const c = useAuditoriaPageController();
  const ejecutivo = useAuditoriaEjecutivo();
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState<"ejecutivo" | "tabla" | "por_regla">(
    isAdmin ? "ejecutivo" : "tabla",
  );
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

  const handleExportCsv = () => {
    const rows = c.hallazgosFiltrados.map((h) => ({
      severidad: h.severidad,
      expediente: h.expediente,
      regla: reglaShortLabel(h.regla),
      cliente: h.cliente_nombre || "",
      modo: h.modo,
      estado: h.estado,
      eta: h.eta || "",
      detalle: h.detalle,
      documentos_faltantes: (h.documentos_faltantes || []).join(" | "),
    }));
    const fecha = new Date().toISOString().slice(0, 10);
    exportToCsv(
      `auditoria_${fecha}.csv`,
      [
        { key: "severidad", label: "Severidad" },
        { key: "expediente", label: "Expediente" },
        { key: "regla", label: "Regla" },
        { key: "cliente", label: "Cliente" },
        { key: "modo", label: "Modo" },
        { key: "estado", label: "Estado" },
        { key: "eta", label: "ETA" },
        { key: "detalle", label: "Detalle" },
        { key: "documentos_faltantes", label: "Documentos faltantes" },
      ],
      rows,
    );
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
              onClick={handleExportCsv}
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="ejecutivo">Resumen ejecutivo</TabsTrigger>
          <TabsTrigger value="tabla">Hallazgos</TabsTrigger>
          <TabsTrigger value="por_regla">Por regla</TabsTrigger>
        </TabsList>

        {/* ─────── Resumen ejecutivo ─────── */}
        <TabsContent value="ejecutivo" className="mt-0">
          <AuditoriaEjecutivoTab data={ejecutivo} onDrillDown={handleDrillDown} />
        </TabsContent>

        {/* ─────── Hallazgos ─────── */}
        <TabsContent value="tabla" className="mt-0 space-y-4">
          {c.isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : !c.data ? (
            <div className="text-sm text-muted-foreground">No se pudo cargar el reporte.</div>
          ) : (
            <>
              <AuditoriaKpis
                critico={c.kpiSeveridad.critico}
                alto={c.kpiSeveridad.alto}
                medio={c.kpiSeveridad.medio}
              />

              {c.revisadosCount > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {c.mostrarRevisados ? (
                      <>
                        Mostrando también <span className="font-semibold text-foreground">{c.revisadosCount}</span> hallazgo
                        {pluralS(c.revisadosCount)} ya revisado{pluralS(c.revisadosCount)}.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-foreground">{c.revisadosCount}</span> hallazgo
                        {pluralS(c.revisadosCount)} revisado{pluralS(c.revisadosCount)} oculto
                        {pluralS(c.revisadosCount)}.
                      </>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => c.setMostrarRevisados((v) => !v)}
                  >
                    {c.mostrarRevisados ? (
                      <>
                        <EyeOff className="mr-1 h-3.5 w-3.5" />
                        Ocultar revisados
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Ver revisados
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Severidad:</span>
                  <Select
                    value={c.filtroSev}
                    onValueChange={(v) => c.setFiltroSev(v as SeveridadAuditoria | "todas")}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="critico">Crítico</SelectItem>
                      <SelectItem value="alto">Alto</SelectItem>
                      <SelectItem value="medio">Medio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Modo:</span>
                  <Select value={c.filtroModo} onValueChange={c.setFiltroModo}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {c.modos.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto text-xs text-muted-foreground tabular-nums">
                  Mostrando <span className="font-semibold text-foreground">{c.hallazgosFiltrados.length}</span> de{" "}
                  {c.hallazgosVisibles.length} hallazgos
                  {!c.mostrarRevisados && c.revisadosCount > 0 && (
                    <span className="text-muted-foreground/70"> · {c.data.total_hallazgos} totales</span>
                  )}
                </div>
              </div>

              <HallazgosTablaPaginada
                key={tablaKey}
                hallazgos={c.hallazgos}
                mostrarRevisadosDefault={c.mostrarRevisados}
                initialFilters={drillFilters}
              />
            </>
          )}
        </TabsContent>

        {/* ─────── Por regla ─────── */}
        <TabsContent value="por_regla" className="mt-0">
          {c.isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <Accordion type="multiple" defaultValue={REGLAS_ORDEN} className="space-y-2">
              {REGLAS_ORDEN.map((regla) => {
                const cfg = REGLA_INFO[regla];
                const items = c.porRegla[regla];
                const Icon = cfg.icon;
                return (
                  <AccordionItem key={regla} value={regla} className="border rounded-md px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{cfg.label}</div>
                          <div className="text-xs text-muted-foreground font-normal">
                            {cfg.description}
                          </div>
                        </div>
                        <Badge variant={items.length > 0 ? "destructive" : "secondary"}>
                          {items.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <HallazgoTabla hallazgos={items} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
