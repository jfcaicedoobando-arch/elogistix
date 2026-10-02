/** Insignia A/B/C con el puntaje. "—" si no aplica (cerrada o sin dato). */
import { Badge } from "@/components/ui/badge";
import type { LetraPuntaje } from "@/features/crm/services/scoring/scoringCrm";

const VARIANTE: Record<LetraPuntaje, "success" | "warning" | "neutral"> = { A: "success", B: "warning", C: "neutral" };

interface Props { letra: LetraPuntaje | null | undefined; puntaje?: number | null }

export function InsigniaPuntaje({ letra, puntaje }: Props) {
  if (!letra) return <span className="text-muted-foreground">—</span>;
  const texto = typeof puntaje === "number" ? `${letra} · ${puntaje}` : letra;
  return <Badge variant={VARIANTE[letra]} aria-label={`Puntaje ${texto}`}>{texto}</Badge>;
}
