/**
 * Margen esperado de la oportunidad y su autorización de gerencia
 * (mapeo del CRM comercial Hunter). La escritura pasa por la RPC
 * `crm_autorizar_margen`, que valida SoD en base de datos.
 */
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutorizarMargen } from "@/features/crm/hooks/useAutorizarMargen";
import { usePermissions } from "@/hooks/shared";
import { formatDateTimeMx } from "@/lib/formatters/dates";

interface Props {
  oportunidadId: string;
  margenPct: number | null;
  autorizadoAt: string | null;
  riesgos: string | null;
}

const AUTORIZADORES = ["super_admin", "admin_org", "admin", "gerente_comercial"];

export function MargenAutorizacionCard({ oportunidadId, margenPct, autorizadoAt, riesgos }: Props) {
  const { role } = usePermissions();
  const puedeAutorizar = AUTORIZADORES.includes(String(role ?? ""));
  const autorizar = useAutorizarMargen();
  const [valor, setValor] = useState<string>(margenPct != null ? String(margenPct) : "");

  const handleAutorizar = () =>
    autorizar.mutate({
      oportunidadId,
      margenPct: Math.max(0, Math.min(100, Number(valor) || 0)),
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Margen y riesgo</CardTitle>
        {autorizadoAt ? (
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" /> Autorizado {formatDateTimeMx(autorizadoAt)}
          </Badge>
        ) : (
          <Badge variant="secondary">Sin autorizar</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="margen-autorizar">Margen esperado (%)</Label>
            <Input
              id="margen-autorizar"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={!puedeAutorizar}
            />
          </div>
          {puedeAutorizar && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutorizar}
              loading={autorizar.isPending}
            >
              <ShieldCheck className="h-4 w-4 mr-1" /> Autorizar margen
            </Button>
          )}
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Riesgos / objeciones</div>
          {riesgos && riesgos.length > 0 ? riesgos : "—"}
        </div>
      </CardContent>
    </Card>
  );
}
