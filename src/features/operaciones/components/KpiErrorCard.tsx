/**
 * Fallback de KPI cuando la consulta falla: NUNCA mostrar "0" en su lugar
 * (un 0 falso puede leerse como "al día" y ocultar un problema real).
 */
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface KpiErrorCardProps {
  onRetry: () => void;
  label?: string;
}

export function KpiErrorCard({ onRetry, label = "Tarifas pendientes" }: KpiErrorCardProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 flex flex-col justify-center gap-2 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-body-sm text-muted-foreground">No se pudo cargar</p>
      <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
        Reintentar
      </Button>
    </Card>
  );
}
