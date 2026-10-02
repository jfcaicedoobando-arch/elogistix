/**
 * Insignia del reloj de respuesta de Pricing. Se refresca cada minuto.
 */
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcularReloj } from "@/features/crm/services/pricing/relojPricing";

interface Props { enviadaAt: string | null; venceAt: string | null; respondidaAt: string | null }

const COLOR = {
  ok: "border-success/40 bg-success/10 text-success",
  alerta: "border-warning/40 bg-warning/10 text-warning",
  vencida: "border-destructive/40 bg-destructive/10 text-destructive",
  detenida: "border-border bg-muted text-muted-foreground",
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
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-body-sm", COLOR[reloj.nivel])}>
      <Clock className="h-3.5 w-3.5" />
      {reloj.texto}
    </span>
  );
}
