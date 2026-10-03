/**
 * Insignia del reloj de respuesta de Pricing. Se refresca cada minuto.
 */
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calcularReloj } from "@/features/crm/services/pricing/relojPricing";

interface Props { enviadaAt: string | null; venceAt: string | null; respondidaAt: string | null }

const VARIANTE = {
  ok: "success",
  alerta: "warning",
  vencida: "destructive",
  detenida: "neutral",
} as const;

export function RelojPricing({ enviadaAt, venceAt, respondidaAt }: Props) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    if (respondidaAt) return undefined;
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, [respondidaAt]);

  const reloj = calcularReloj({ enviadaAt, venceAt, respondidaAt, ahora });
  if (!reloj) return <span className="text-body-sm text-muted-foreground">—</span>;
  return (
    <Badge variant={VARIANTE[reloj.nivel]} className="gap-1">
      <Clock className="h-3.5 w-3.5" />
      {reloj.texto}
    </Badge>
  );
}
