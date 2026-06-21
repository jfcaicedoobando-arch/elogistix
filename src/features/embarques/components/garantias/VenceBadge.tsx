import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";

/** Diferencia en días entre dos fechas ISO (YYYY-MM-DD). */
export function diffDias(desdeIso: string, hastaIso: string): number {
  const a = new Date(desdeIso + "T00:00:00").getTime();
  const b = new Date(hastaIso + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function VenceBadge({ fechaLimite }: { fechaLimite: string | null }) {
  if (!fechaLimite) return <span className="text-muted-foreground">—</span>;
  const hoyIso = new Date().toISOString().slice(0, 10);
  const dias = diffDias(hoyIso, fechaLimite);
  if (dias < 0) {
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Vencido hace {Math.abs(dias)}d</Badge>;
  }
  if (dias <= 3) {
    return <Badge className="bg-warning/15 text-warning border-warning/30">Vence en {dias}d</Badge>;
  }
  return <Badge className="bg-success/15 text-success border-success/30">{formatDate(fechaLimite)}</Badge>;
}
