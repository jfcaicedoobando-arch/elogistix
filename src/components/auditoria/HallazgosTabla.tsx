/**
 * Tabla pura de hallazgos de auditoría — render solamente.
 */
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, UserPlus, UserCheck, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import { revisionKey } from "@/hooks/auditoria";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";
import {
  formatEta,
  reglaLabel,
  reglaToTab,
  severidadConfig,
} from "./hallazgosTablaConfig";

interface Props {
  visibles: HallazgoAuditoria[];
  start: number;
  revisiones: Map<string, AuditoriaRevision> | undefined;
  currentUserId?: string | null;
  onMarcarRevisado: (h: HallazgoAuditoria) => void;
  onAsignarResponsable: (h: HallazgoAuditoria) => void;
}

function isVencida(fechaLimite: string | null): boolean {
  if (!fechaLimite) return false;
  const today = new Date().toISOString().slice(0, 10);
  return fechaLimite < today;
}

export function HallazgosTabla({ visibles, start, revisiones, currentUserId, onMarcarRevisado, onAsignarResponsable }: Props) {
  const navigate = useNavigate();

  const getRevision = (h: HallazgoAuditoria) => revisiones?.get(revisionKey(h)) ?? null;

  const cols: ColumnDef<HallazgoAuditoria, unknown>[] = defineColumns<HallazgoAuditoria>([
    { id: "sev", header: "Severidad", meta: { width: "w-[100px]" },
      cell: ({ row }) => {
        const sev = severidadConfig[row.original.severidad];
        return <Badge variant="outline" className={cn("text-[10px]", sev.className)}>{sev.label}</Badge>;
      } },
    { id: "exp", header: "Expediente", meta: { width: "w-[130px]", className: "font-medium tabular-nums text-xs" },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`); }}
            className="text-primary hover:underline focus:outline-none focus:underline"
            title={`Abrir embarque ${h.expediente}`}
          >
            {h.expediente}
          </button>
        );
      } },
    { id: "regla", header: "Regla", meta: { width: "w-[160px]", className: "text-xs text-muted-foreground" }, cell: ({ row }) => reglaLabel[row.original.regla] },
    { id: "cliente", header: "Cliente", meta: { className: "truncate max-w-[180px] text-xs" },
      cell: ({ row }) => <span title={row.original.cliente_nombre}>{row.original.cliente_nombre || "—"}</span> },
    { id: "estado", header: "Estado", meta: { width: "w-[110px]", className: "text-xs text-muted-foreground" }, cell: ({ row }) => row.original.estado },
    { id: "eta", header: "ETA", meta: { width: "w-[100px]", className: "text-xs tabular-nums text-muted-foreground" }, cell: ({ row }) => formatEta(row.original.eta) },
    { id: "detalle", header: "Detalle", meta: { className: "text-xs" },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <>
            <div>{h.detalle}</div>
            {h.documentos_faltantes && h.documentos_faltantes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {h.documentos_faltantes.map((doc) => (
                  <Badge key={doc} variant="secondary" className="text-[10px] font-normal">{doc}</Badge>
                ))}
              </div>
            )}
          </>
        );
      } },
    { id: "resp", header: "Responsable", meta: { width: "w-[170px]", className: "text-xs" },
      cell: ({ row }) => {
        const h = row.original;
        const revision = getRevision(h);
        const responsable = revision?.responsable_id ? revision : null;
        const vencida = isVencida(revision?.fecha_limite ?? null) && revision?.estado_revision !== "revisado";
        if (!responsable) {
          return (
            <Button size="sm" variant="ghost"
              className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onAsignarResponsable(h); }}
            >
              <UserPlus className="h-3.5 w-3.5" /> Asignar
            </Button>
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAsignarResponsable(h); }}
            className={cn(
              "flex items-center gap-1 hover:underline focus:outline-none focus:underline text-left",
              responsable.responsable_id === currentUserId ? "text-primary font-medium" : "text-foreground",
            )}
            title={`Asignado por ${responsable.asignado_por_email || "—"}${
              responsable.asignado_at ? ` el ${format(new Date(responsable.asignado_at), "dd/MM/yyyy HH:mm")}` : ""
            }${responsable.fecha_limite ? `\nFecha límite: ${format(new Date(`${responsable.fecha_limite}T00:00:00`), "dd/MM/yyyy")}` : ""}`}
          >
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[110px]">{responsable.responsable_email}</span>
            {vencida && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" aria-label="Vencido" />}
          </button>
        );
      } },
    { id: "rev", header: "Revisión", meta: { width: "w-[150px]" },
      cell: ({ row }) => {
        const h = row.original;
        const revision = getRevision(h);
        if (revision?.estado_revision === "revisado") {
          return (
            <Button size="sm" variant="ghost"
              className="h-7 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
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
              className="h-7 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-400"
              onClick={(e) => { e.stopPropagation(); onMarcarRevisado(h); }}
            >
              En progreso
            </Button>
          );
        }
        return (
          <Button size="sm" variant="outline" className="h-7 text-[11px]"
            onClick={(e) => { e.stopPropagation(); onMarcarRevisado(h); }}
          >
            Marcar revisado
          </Button>
        );
      } },
    { id: "open", header: "", meta: { width: "w-[50px]" },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <Button size="icon" variant="ghost" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`); }}
            aria-label="Abrir embarque" title={`Abrir embarque ${h.expediente}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        );
      } },
  ]);

  return (
    <div className="rounded-md border overflow-hidden">
      <DataTable
        columns={cols}
        data={visibles}
        rowKey={(h) => `${h.embarque_id}-${h.regla}-${start + visibles.indexOf(h)}`}
        density="compact"
        rowClassName={(h) => getRevision(h)?.estado_revision === "revisado" ? "opacity-70" : ""}
        emptyMessage="Sin hallazgos que coincidan con los filtros."
      />
    </div>
  );
}
