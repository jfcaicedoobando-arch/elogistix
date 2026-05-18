import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pluralS } from "@/lib/formatters";
import { AuditoriaKpis } from "@/components/auditoria/AuditoriaKpis";
import { HallazgosTablaPaginada } from "@/components/auditoria/HallazgosTablaPaginada";
import type { useAuditoriaPageController } from "@/hooks/auditoria";
import type { UseHallazgosTablaStateOptions } from "@/hooks/auditoria";
import type { SeveridadAuditoria } from "@/types/auditoria";

interface Props {
  c: ReturnType<typeof useAuditoriaPageController>;
  drillFilters: UseHallazgosTablaStateOptions;
  tablaKey: number;
}

export function AuditoriaHallazgosTab({ c, drillFilters, tablaKey }: Props) {
  if (c.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!c.data) {
    return <div className="text-sm text-muted-foreground">No se pudo cargar el reporte.</div>;
  }
  return (
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
  );
}
