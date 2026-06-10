import { Badge } from "@/components/ui/badge";
import type { CosteoTarifaEstado } from "@/features/costeo/types";

const MAP: Record<CosteoTarifaEstado, { label: string; cls: string }> = {
  vigente: { label: "Vigente", cls: "bg-success/15 text-success border-success/30" },
  vencida: { label: "Vencida", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  reemplazada: { label: "Reemplazada", cls: "bg-muted text-muted-foreground border-border" },
  borrador: { label: "Borrador", cls: "bg-warning/15 text-warning border-warning/30" },
};

export function TarifaEstadoBadge({
  estado,
  vigenteHasta,
}: {
  estado: CosteoTarifaEstado;
  vigenteHasta?: string;
}) {
  // Derivar "vencida" si la fecha ya pasó aunque estado siga "vigente".
  let efectivo: CosteoTarifaEstado = estado;
  if (estado === "vigente" && vigenteHasta) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (vigenteHasta < hoy) efectivo = "vencida";
  }
  const cfg = MAP[efectivo];
  return (
    <Badge variant="outline" className={cfg.cls}>
      {cfg.label}
    </Badge>
  );
}
