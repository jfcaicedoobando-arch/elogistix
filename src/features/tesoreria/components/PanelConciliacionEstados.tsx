/**
 * Bloques de estado del panel de conciliación (Tesorería).
 *
 * Se separan del panel para bajar su complejidad ciclomática y mantener cada
 * archivo corto: movimiento ya conciliado, movimiento ignorado y la lista de
 * candidatos a conciliar.
 */
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CandidatoConciliacion } from "@/features/tesoreria/services";

export function EstadoConciliado({
  tienePago,
  onVerPago,
  onDesconciliar,
}: {
  tienePago: boolean;
  onVerPago: () => void;
  onDesconciliar: () => void;
}) {
  return (
    <>
      <Badge className="bg-success/10 text-success border-success/20">Conciliado</Badge>
      {tienePago ? (
        <Button variant="outline" size="sm" onClick={onVerPago} className="w-full">
          <Eye className="h-4 w-4 mr-2" />
          Ver detalle del pago
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Este movimiento está conciliado, pero no guarda el pago con el que se amarró.
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onDesconciliar} className="w-full">
        Desconciliar
      </Button>
    </>
  );
}

export function EstadoIgnorado({
  motivo,
  onReactivar,
}: {
  motivo?: string | null;
  onReactivar: () => void;
}) {
  return (
    <>
      <Badge variant="outline">Ignorado</Badge>
      {motivo ? <p className="text-xs text-muted-foreground">Motivo: {motivo}</p> : null}
      <Button variant="outline" size="sm" onClick={onReactivar} className="w-full">
        Reactivar (volver a Pendiente)
      </Button>
    </>
  );
}

interface ListaCandidatosProps {
  candidatos: readonly CandidatoConciliacion[];
  isLoading: boolean;
  isPending: boolean;
  onConciliar: (tipo: "cxc" | "cxp", pagoId: string) => void;
  onIgnorar: () => void;
}

export function ListaCandidatos({
  candidatos,
  isLoading,
  isPending,
  onConciliar,
  onIgnorar,
}: ListaCandidatosProps) {
  return (
    <>
      <div>
        <h4 className="text-xs font-semibold mb-2 text-muted-foreground">
          Candidatos (±$1, ±5 días)
        </h4>
        {isLoading ? <CardSkeleton lines={2} showHeader={false} /> : null}
        {!isLoading && candidatos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin candidatos. Crea el pago manualmente desde CxC/CxP o ignora este movimiento.
          </p>
        ) : null}
        {!isLoading && candidatos.length > 0 ? (
          <ul className="space-y-2">
            {candidatos.map((c) => (
              <li key={`${c.tipo}-${c.pago_id}`} className="border rounded p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{c.contraparte}</span>
                  <Badge variant="outline" className="text-2xs">{c.tipo.toUpperCase()}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {formatDate(c.fecha)} · Ref {c.referencia || "—"}
                </div>
                <div className="flex justify-between items-center">
                  <span className="tabular-nums font-medium">
                    {formatCurrency(c.monto, c.moneda)}
                  </span>
                  <Button size="sm" onClick={() => onConciliar(c.tipo, c.pago_id)} disabled={isPending}>
                    Conciliar
                  </Button>
                </div>
                <div className="text-2xs text-muted-foreground">
                  Δ monto {c.delta_monto.toFixed(2)} · Δ días {c.delta_dias}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Button variant="outline" size="sm" onClick={onIgnorar} className="w-full">
        Ignorar (comisión, traspaso, etc.)
      </Button>
    </>
  );
}
