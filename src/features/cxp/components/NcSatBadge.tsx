/**
 * Badge de estatus SAT + botón de verificación para notas de crédito de proveedor.
 */
import { ShieldCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVerificarUuidNcSat } from "@/features/cxp/hooks/useVerificarUuidNcSat";

interface Props {
  facturaId: string;
  ncId: string;
  uuidFiscal?: string | null;
  estatus?: string | null;
}

export function NcSatBadge({ facturaId, ncId, uuidFiscal, estatus }: Props) {
  const verificar = useVerificarUuidNcSat(facturaId);
  if (!uuidFiscal) return <span className="text-muted-foreground/40">—</span>;

  const tone =
    estatus === "Vigente" ? "bg-success/15 text-success border-success/30" :
    estatus === "Cancelado" ? "bg-destructive/15 text-destructive border-destructive/30" :
    estatus === "No Encontrado" ? "bg-warning/15 text-warning border-warning/30" :
    "bg-muted text-muted-foreground border-muted";

  return (
    <div className="flex items-center justify-center gap-1">
      <Badge className={tone} variant="outline">
        {estatus ?? "Sin verificar"}
      </Badge>
      <Button
        size="sm" variant="ghost"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => verificar.mutate(ncId)}
        disabled={verificar.isPending}
        title="Verificar en SAT"
      >
        {verificar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
      </Button>
    </div>
  );
}
