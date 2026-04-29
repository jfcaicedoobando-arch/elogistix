import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
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
import type { HallazgoAuditoria, SeveridadAuditoria } from "@/hooks/auditoria/useAuditoria";
import { cn } from "@/lib/utils";

interface Props {
  hallazgos: HallazgoAuditoria[];
}

const severidadConfig: Record<SeveridadAuditoria, { label: string; className: string }> = {
  critico: {
    label: "Crítico",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  alto: {
    label: "Alto",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  medio: {
    label: "Medio",
    className: "bg-primary/15 text-primary border-primary/30",
  },
};

function formatEta(eta: string | null): string {
  if (!eta) return "—";
  const [y, m, d] = eta.split("-");
  return `${d}/${m}/${y}`;
}

export function HallazgoTabla({ hallazgos }: Props) {
  const navigate = useNavigate();

  if (hallazgos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Sin hallazgos en esta categoría.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Severidad</TableHead>
            <TableHead className="w-[140px]">Expediente</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-[110px]">Estado</TableHead>
            <TableHead className="w-[110px]">ETA</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {hallazgos.map((h, i) => {
            const sev = severidadConfig[h.severidad];
            return (
              <TableRow
                key={`${h.embarque_id}-${h.regla}-${i}`}
                className={cn(i % 2 === 1 && "bg-muted/30")}
              >
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", sev.className)}>
                    {sev.label}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium tabular-nums">{h.expediente}</TableCell>
                <TableCell className="truncate max-w-[200px]" title={h.cliente_nombre}>
                  {h.cliente_nombre || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{h.estado}</TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">
                  {formatEta(h.eta)}
                </TableCell>
                <TableCell className="text-sm">
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
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => navigate(`/embarques/${h.embarque_id}`)}
                    aria-label="Abrir embarque"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
