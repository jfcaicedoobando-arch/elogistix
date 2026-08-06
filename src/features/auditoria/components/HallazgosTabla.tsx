/**
 * Tabla pura de hallazgos de auditoría — render solamente.
 */
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, UserPlus, UserCheck, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import { revisionKey } from "@/features/auditoria/hooks";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";
import {
  reglaLabel,
  reglaToTab,
  severidadConfig,
} from "./hallazgosTablaConfig";
import { ExplicarHallazgoButton } from "./ExplicarHallazgoButton";
import { HallazgoDetalleCell } from "./HallazgoDetalleCell";
import { buildSelectColumn } from "./hallazgosTablaSelectColumn";
import { todayLocalISO } from "@/lib/date/today";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface Props {
  visibles: HallazgoAuditoria[];
  start: number;
  revisiones: Map<string, AuditoriaRevision> | undefined;
  currentUserId?: string | null;
  onMarcarRevisado: (h: HallazgoAuditoria) => void;
  onAsignarResponsable: (h: HallazgoAuditoria) => void;
  // Selección múltiple
  selectedIds: Set<string>;
  selectablesEnPagina: string[];
  onToggleSelected: (id: string) => void;
  onToggleAllVisible: () => void;
}

function isVencida(fechaLimite: string | null): boolean {
  if (!fechaLimite) return false;
  const today = todayLocalISO();
  return fechaLimite < today;
}

export function HallazgosTabla(props: Props) {
  const {
    visibles, start, revisiones, currentUserId,
    onMarcarRevisado, onAsignarResponsable,
    selectedIds, selectablesEnPagina, onToggleSelected, onToggleAllVisible,
  } = props;
  const abrirEmbarque = (h: HallazgoAuditoria) => {
    window.open(
      `${window.location.origin}/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`,
      "_blank", "noopener,noreferrer",
    );
  };
  const getRevision = (h: HallazgoAuditoria) => revisiones?.get(revisionKey(h)) ?? null;

  const cols: ColumnDef<HallazgoAuditoria, unknown>[] = defineColumns<HallazgoAuditoria>([
    buildSelectColumn({ revisiones, selectedIds, selectablesEnPagina, onToggleSelected, onToggleAllVisible }),
    { id: "sev", header: "Severidad", meta: { width: COL_W.fecha },
      cell: ({ row }) => {
        const sev = severidadConfig[row.original.severidad];
        return <Badge variant="outline" className={cn("text-2xs", sev.className)}>{sev.label}</Badge>;
      } },
    { id: "exp", header: "Expediente", meta: { width: COL_W.monto, className: "font-medium tabular-nums text-xs" },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 font-normal"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirEmbarque(h); }}
            title={`Abrir embarque ${h.expediente}`}
          >
            {h.expediente}
          </Button>
        );
      } },
    { id: "regla", header: "Regla", meta: { width: COL_W.nombre, className: "text-xs text-muted-foreground" }, cell: ({ row }) => reglaLabel[row.original.regla] },
    { id: "detalle", header: "Detalle", meta: { className: "text-xs" },
      cell: ({ row }) => {
        return <HallazgoDetalleCell hallazgo={row.original} />;
      } },
    { id: "resp", header: "Responsable", meta: { width: COL_W.ruta, className: "text-xs" },
      cell: ({ row }) => {
        const h = row.original;
        const revision = getRevision(h);
        const responsable = revision?.responsable_id ? revision : null;
        const vencida = isVencida(revision?.fecha_limite ?? null) && revision?.estado_revision !== "revisado";
        if (!responsable) {
          return (
            <Button size="sm" variant="ghost"
              className="h-7 text-label gap-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onAsignarResponsable(h); }}
            >
              <UserPlus className="h-3.5 w-3.5" /> Asignar
            </Button>
          );
        }
        return (
          <Button
            variant="link"
            size="sm"
            className={cn(
              "h-auto p-0 flex items-center gap-1 text-left justify-start",
              responsable.responsable_id === currentUserId ? "text-primary font-medium" : "text-foreground",
            )}
            onClick={(e) => { e.stopPropagation(); onAsignarResponsable(h); }}
            title={`Asignado por ${responsable.asignado_por_email || "—"}${
              responsable.asignado_at ? ` el ${format(new Date(responsable.asignado_at), "dd/MM/yyyy HH:mm")}` : ""
            }${responsable.fecha_limite ? `\nFecha límite: ${format(new Date(`${responsable.fecha_limite}T00:00:00`), "dd/MM/yyyy")}` : ""}`}
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[110px]">{responsable.responsable_email}</span>
            {vencida && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" aria-label="Vencido" />}
          </Button>
        );
      } },
    { id: "rev", header: "Revisión", meta: { width: COL_W.monto },
      cell: ({ row }) => {
        const h = row.original;
        const revision = getRevision(h);
        if (revision?.estado_revision === "revisado") {
          return (
            <Button size="sm" variant="ghost"
              className="h-7 text-label gap-1 text-success hover:text-success dark:text-success"
              onClick={(e) => { e.stopPropagation(); onMarcarRevisado(h); }}
              title={`Por: ${revision.revisado_por_email ?? "—"}\n${format(new Date(revision.updated_at), "dd/MM/yyyy HH:mm")}\nAcción: ${revision.accion_tomada ?? ""}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Revisado
            </Button>
          );
        }
        if (revision?.estado_revision === "en_progreso") {
          return (
            <Button size="sm" variant="outline"
              className="h-7 text-label border-warning/40 text-warning"
              onClick={(e) => { e.stopPropagation(); onMarcarRevisado(h); }}
            >
              En progreso
            </Button>
          );
        }
        return (
          <Button size="sm" variant="outline" className="h-7 text-label"
            onClick={(e) => { e.stopPropagation(); onMarcarRevisado(h); }}
          >
            Marcar revisado
          </Button>
        );
      } },
    { id: "open", header: "", meta: { width: COL_W.short },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <ExplicarHallazgoButton hallazgo={h} />
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirEmbarque(h); }}
              aria-label="Abrir embarque" title={`Abrir embarque ${h.expediente}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      } },
  ]);

  return (
    <div className="rounded-md border overflow-hidden">
      <DataTable
        columns={cols}
        data={visibles}
        rowKey={(h) => `${h.embarque_id}-${h.regla}-${start + visibles.indexOf(h)}`}
        density={TABLE_DENSITY.embebida}
        rowClassName={(h) => getRevision(h)?.estado_revision === "revisado" ? "opacity-70" : ""}
        emptyMessage="Sin hallazgos que coincidan con los filtros."
      />
    </div>
  );
}
