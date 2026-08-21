/**
 * Badge de estatus SAT + botón de verificación para notas de crédito de proveedor.
 */
import { ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useVerificarUuidNcSat } from "@/features/cxp/hooks/useVerificarUuidNcSat";
import { Hint } from "@/components/shared/Hint";

interface Props {
  facturaId: string;
  ncId: string;
  uuidFiscal?: string | null;
  estatus?: string | null;
}

export function NcSatBadge({ facturaId, ncId, uuidFiscal, estatus }: Props) {
  const verificar = useVerificarUuidNcSat(facturaId);
  if (!uuidFiscal) return <span className="text-muted-foreground/40">—</span>;

  return (
    <div className="flex items-center justify-center gap-1">
      <StatusBadge domain="sat_uuid" status={estatus ?? "Sin verificar"} />
      <Hint label="Verificar en SAT">
        <Button
          size="sm" variant="ghost"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => verificar.mutate(ncId)}
          disabled={verificar.isPending}
          loading={verificar.isPending}
          aria-label="Verificar en SAT"
        >
          {!verificar.isPending && <ShieldCheck className="h-4 w-4" />}
        </Button>
      </Hint>
    </div>
  );
}
