import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, RefreshCw, FileWarning, Clock, Receipt, FileX } from "lucide-react";
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
import { AuditoriaKpis } from "@/components/auditoria/AuditoriaKpis";
import { HallazgoTabla } from "@/components/auditoria/HallazgoTabla";
import {
  AUDITORIA_QUERY_KEY,
  useAuditoria,
  type HallazgoAuditoria,
  type ReglaAuditoria,
  type SeveridadAuditoria,
} from "@/hooks/auditoria/useAuditoria";

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
  const { data, isLoading, isFetching } = useAuditoria();
  const queryClient = useQueryClient();
  const [filtroSev, setFiltroSev] = useState<SeveridadAuditoria | "todas">("todas");
  const [filtroModo, setFiltroModo] = useState<string>("todos");

  const hallazgos = data?.hallazgos ?? [];

  const hallazgosFiltrados = useMemo(() => {
    return hallazgos.filter((h) => {
      if (filtroSev !== "todas" && h.severidad !== filtroSev) return false;
      if (filtroModo !== "todos" && h.modo !== filtroModo) return false;
      return true;
    });
  }, [hallazgos, filtroSev, filtroModo]);

  const porRegla = useMemo(() => {
    const map: Record<ReglaAuditoria, HallazgoAuditoria[]> = {
      docs_faltantes: [],
      docs_pendientes_avanzado: [],
      fechas: [],
      ventas_sin_facturar: [],
    };
    for (const h of hallazgosFiltrados) map[h.regla].push(h);
    return map;
  }, [hallazgosFiltrados]);

  const modos = useMemo(() => {
    const set = new Set(hallazgos.map((h) => h.modo).filter(Boolean));
    return Array.from(set).sort();
  }, [hallazgos]);

  const handleRecalcular = () => {
    queryClient.invalidateQueries({ queryKey: AUDITORIA_QUERY_KEY });
  };

  const generadoEn = data?.generated_at
    ? new Date(data.generated_at).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Auditoría operativa"
        description="Inconsistencias detectadas entre documentos, estados y fechas de embarques."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalcular}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
        }
      />

      {generadoEn && (
        <div className="text-xs text-muted-foreground">
          Reporte generado: <span className="tabular-nums">{generadoEn}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : !data ? (
        <div className="text-sm text-muted-foreground">No se pudo cargar el reporte.</div>
      ) : (
        <>
          <AuditoriaKpis
            critico={data.por_severidad.critico}
            alto={data.por_severidad.alto}
            medio={data.por_severidad.medio}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Severidad:</span>
              <Select value={filtroSev} onValueChange={(v) => setFiltroSev(v as typeof filtroSev)}>
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
              <Select value={filtroModo} onValueChange={setFiltroModo}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {modos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-xs text-muted-foreground tabular-nums">
              Mostrando <span className="font-semibold text-foreground">{hallazgosFiltrados.length}</span> de{" "}
              {data.total_hallazgos} hallazgos
            </div>
          </div>

          <Accordion type="multiple" defaultValue={REGLAS_ORDEN} className="space-y-2">
            {REGLAS_ORDEN.map((regla) => {
              const cfg = reglaConfig[regla];
              const items = porRegla[regla];
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
        </>
      )}
    </div>
  );
}
