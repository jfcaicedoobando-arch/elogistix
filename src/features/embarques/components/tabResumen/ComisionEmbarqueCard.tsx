/**
 * v13.386.0 — Regla de comisión del embarque.
 *
 * Tres estados: heredar del cliente, forzar "sí genera", forzar "no genera".
 * Se muestra el valor efectivo resuelto en BD para que no haya sorpresas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Percent } from "lucide-react";
import { usePermissions } from "@/hooks/shared/usePermissions";
import {
  useSinComisionEmbarque,
  useSetSinComisionEmbarque,
} from "@/features/embarques/hooks/useSinComisionEmbarque";
import type { SinComisionOverride } from "@/features/embarques/services/comisionExclusion";

const VALOR_HEREDAR = "heredar";
const VALOR_SI = "si";
const VALOR_NO = "no";

function overrideToValor(override: SinComisionOverride): string {
  if (override === null) return VALOR_HEREDAR;
  return override ? VALOR_NO : VALOR_SI;
}

function valorToOverride(valor: string): SinComisionOverride {
  if (valor === VALOR_HEREDAR) return null;
  return valor === VALOR_NO;
}

export function ComisionEmbarqueCard({ embarqueId }: { embarqueId: string }) {
  const { canEdit } = usePermissions();
  const { data, isLoading } = useSinComisionEmbarque(embarqueId);
  const setSinComision = useSetSinComisionEmbarque();

  if (isLoading || !data) return null;

  const efectivo = data.efectivo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          Comisión de venta
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-sm">
        <div className="space-y-1">
          <Label className="text-xs">Regla de este embarque</Label>
          <Select
            value={overrideToValor(data.override)}
            onValueChange={(v) =>
              setSinComision.mutate({ embarqueId, valor: valorToOverride(v) })
            }
            disabled={!canEdit || setSinComision.isPending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VALOR_HEREDAR}>Heredar del cliente</SelectItem>
              <SelectItem value={VALOR_SI}>Sí genera comisión</SelectItem>
              <SelectItem value={VALOR_NO}>No genera comisión</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</div>
          <Badge variant={efectivo ? "outline" : "secondary"}>
            {efectivo ? "No genera comisión" : "Genera comisión"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {efectivo
              ? "Los cobros de este embarque no devengan comisión."
              : "Cada cobro de factura devenga comisión para la vendedora asignada."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
