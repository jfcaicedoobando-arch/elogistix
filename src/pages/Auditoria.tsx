import { ShieldAlert, RefreshCw, FileWarning, Clock, Receipt, FileX, Eye, EyeOff } from "lucide-react";
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
import { HallazgoTabla } from "@/components/auditoria/HallazgoTabla";
import { HallazgosTablaPaginada } from "@/components/auditoria/HallazgosTablaPaginada";
import { useAuditoriaPageController } from "@/hooks/auditoria/useAuditoriaPageController";
import type { ReglaAuditoria, SeveridadAuditoria } from "@/types/auditoria";

const reglaConfig: Record<
  ReglaAuditoria,
  { label: string; description: string; icon: typeof FileWarning }
> = {
  docs_faltantes: {
    label: "Documentos faltantes según etapa",
    description: "Documentos obligatorios que aún no se cargan para el estado actual del embarque.",
    icon: FileWarning,
  },
  docs_pendientes_avanzado: {
    label: "Documentos pendientes en embarques avanzados",
    description: "Documentos en estado 'Pendiente' aunque el embarque ya está en operación o cerrado.",
    icon: FileX,
  },
  fechas: {
    label: "Estados inconsistentes con fechas",
    description: "ETD/ETA o fechas reales que no concuerdan con el estado registrado.",
    icon: Clock,
  },
  ventas_sin_facturar: {
    label: "Ventas pendientes de facturar",
    description: "Embarques entregados o cerrados con conceptos de venta sin facturar.",
    icon: Receipt,
  },
};

const REGLAS_ORDEN: ReglaAuditoria[] = [
  "docs_pendientes_avanzado",
  "ventas_sin_facturar",
  "docs_faltantes",
  "fechas",
];

export default function Auditoria() {
  const c = useAuditoriaPageController();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Auditoría operativa"
        description="Inconsistencias detectadas entre documentos, estados y fechas de embarques."
        actions={
          <Button variant="outline" size="sm" onClick={c.handleRecalcular} disabled={c.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${c.isFetching ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
        }
      />

      {c.generadoEn && (
        <div className="text-xs text-muted-foreground">
          Reporte generado: <span className="tabular-nums">{c.generadoEn}</span>
        </div>
      )}

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
                    {c.revisadosCount === 1 ? "" : "s"} ya revisado{c.revisadosCount === 1 ? "" : "s"}.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{c.revisadosCount}</span> hallazgo
                    {c.revisadosCount === 1 ? "" : "s"} revisado{c.revisadosCount === 1 ? "" : "s"} oculto
                    {c.revisadosCount === 1 ? "" : "s"}.
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

          <Tabs defaultValue="tabla" className="space-y-3">
            <TabsList>
              <TabsTrigger value="tabla">Tabla completa</TabsTrigger>
              <TabsTrigger value="por_regla">Por regla</TabsTrigger>
            </TabsList>

            <TabsContent value="tabla" className="mt-0">
              <HallazgosTablaPaginada
                hallazgos={c.hallazgos}
                mostrarRevisadosDefault={c.mostrarRevisados}
              />
            </TabsContent>

            <TabsContent value="por_regla" className="mt-0">
              <Accordion type="multiple" defaultValue={REGLAS_ORDEN} className="space-y-2">
                {REGLAS_ORDEN.map((regla) => {
                  const cfg = reglaConfig[regla];
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
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
