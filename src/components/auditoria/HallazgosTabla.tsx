/**
 * Tabla pura de hallazgos de auditoría — render solamente.
 */
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, UserPlus, UserCheck, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severidad</TableHead>
            <TableHead className="w-[130px]">Expediente</TableHead>
            <TableHead className="w-[160px]">Regla</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-[110px]">Estado</TableHead>
            <TableHead className="w-[100px]">ETA</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className="w-[150px]">Revisión</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                Sin hallazgos que coincidan con los filtros.
              </TableCell>
            </TableRow>
          ) : (
            visibles.map((h, i) => {
              const sev = severidadConfig[h.severidad];
              const revision = revisiones?.get(revisionKey(h)) ?? null;
              return (
                <TableRow
                  key={`${h.embarque_id}-${h.regla}-${start + i}`}
                  className={cn(i % 2 === 1 && "bg-muted/30", revision && "opacity-70")}
                >
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", sev.className)}>
                      {sev.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-xs">
                    <button
                      type="button"
                      onClick={() => navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`)}
                      className="text-primary hover:underline focus:outline-none focus:underline"
                      title={`Abrir embarque ${h.expediente}`}
                    >
                      {h.expediente}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {reglaLabel[h.regla]}
                  </TableCell>
                  <TableCell className="truncate max-w-[180px] text-xs" title={h.cliente_nombre}>
                    {h.cliente_nombre || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.estado}</TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {formatEta(h.eta)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{h.detalle}</div>
                    {h.documentos_faltantes && h.documentos_faltantes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.documentos_faltantes.map((doc) => (
                          <Badge key={doc} variant="secondary" className="text-[10px] font-normal">
                            {doc}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {revision ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        onClick={() => onMarcarRevisado(h)}
                        title={`Por: ${revision.revisado_por_email}\n${format(new Date(revision.updated_at), "dd/MM/yyyy HH:mm")}\nAcción: ${revision.accion_tomada}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Revisado
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => onMarcarRevisado(h)}
                      >
                        Marcar revisado
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`)}
                      aria-label="Abrir embarque"
                      title={`Abrir embarque ${h.expediente}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
