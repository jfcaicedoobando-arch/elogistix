/**
 * Tabla pura de hallazgos de auditoría — render solamente.
 */
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, UserPlus, UserCheck, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import { revisionKey } from "@/hooks/auditoria/useAuditoriaRevisiones";
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

  const cols: DataTableColumn<HallazgoAuditoria>[] = [
    { key: "sev", header: "Severidad", width: "w-[100px]",
      render: (h) => {
        const sev = severidadConfig[h.severidad];
        return <Badge variant="outline" className={cn("text-[10px]", sev.className)}>{sev.label}</Badge>;
      } },
    { key: "exp", header: "Expediente", width: "w-[130px]", className: "font-medium tabular-nums text-xs",
      render: (h) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`); }}
          className="text-primary hover:underline focus:outline-none focus:underline"
          title={`Abrir embarque ${h.expediente}`}
        >
          {h.expediente}
        </button>
      ) },
    { key: "regla", header: "Regla", width: "w-[160px]", className: "text-xs text-muted-foreground", render: (h) => reglaLabel[h.regla] },
    { key: "cliente", header: "Cliente", className: "truncate max-w-[180px] text-xs",
      render: (h) => <span title={h.cliente_nombre}>{h.cliente_nombre || "—"}</span> },
    { key: "estado", header: "Estado", width: "w-[110px]", className: "text-xs text-muted-foreground", render: (h) => h.estado },
    { key: "eta", header: "ETA", width: "w-[100px]", className: "text-xs tabular-nums text-muted-foreground", render: (h) => formatEta(h.eta) },
    { key: "detalle", header: "Detalle", className: "text-xs",
      render: (h) => (
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
      ) },
    { key: "resp", header: "Responsable", width: "w-[170px]", className: "text-xs",
      render: (h) => {
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
    { key: "rev", header: "Revisión", width: "w-[150px]",
      render: (h) => {
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
    { key: "open", header: "", width: "w-[50px]",
      render: (h) => (
        <Button size="icon" variant="ghost" className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`); }}
          aria-label="Abrir embarque" title={`Abrir embarque ${h.expediente}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      ) },
  ];

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
