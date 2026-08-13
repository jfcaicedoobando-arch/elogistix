/**
 * Paso 2 — Cancelar el complemento de pago (REP) del pago recibido.
 * El pago sólo puede moverse a otra factura cuando su REP está cancelado.
 */
import { Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import { tieneRepVivo, type PagoRefacturacion } from "@/features/facturacion/domain/refacturacionPasos";

interface Props {
  pagos: PagoRefacturacion[];
  cargando: boolean;
  cancelandoId: string | null;
  onCancelarRep: (pagoId: string) => void;
  puedeOperar?: boolean;
}

export function PasoCancelarRep({
  pagos, cargando, cancelandoId, onCancelarRep, puedeOperar = true,
}: Props) {
  const conRep = pagos.filter((p) => p.uuid_rep);

  return (
    <FormDialogSection
      title="Complementos de pago (REP)"
      description="El SAT exige cancelar el REP antes de cancelar la factura que lo originó."
      flat
    >
      {cargando && <p className="text-sm text-muted-foreground">Consultando pagos…</p>}

      {!cargando && conRep.length === 0 && (
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
          <span>
            El pago recibido no tiene complemento de pago timbrado. Puedes continuar.
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {conRep.map((p) => {
          const vivo = tieneRepVivo(p);
          return (
            <li
              key={p.id}
              className="rounded-md border p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">
                  {formatCurrency(Number(p.monto), p.moneda)} ·{" "}
                  <span className="text-muted-foreground">{formatFechaEs(p.fecha_pago)}</span>
                </p>
                <p className="text-xs text-muted-foreground break-all">
                  REP {p.uuid_rep}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={vivo ? "outline" : "secondary"}>
                  {vivo ? "REP vigente" : "REP cancelado"}
                </Badge>
                {vivo && (
                  <Button
                    size="sm"
                    variant="destructive"
                    loading={cancelandoId === p.id}
                    disabled={!puedeOperar}
                    onClick={() => onCancelarRep(p.id)}
                  >
                    <Ban className="h-4 w-4 mr-1" /> Cancelar REP
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        La cancelación del REP usa el motivo SAT 02 (comprobante emitido con errores sin
        relación). El dinero permanece en el banco: sólo se retira el comprobante fiscal.
      </p>
    </FormDialogSection>
  );
}
