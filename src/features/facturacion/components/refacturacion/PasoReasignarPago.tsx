/**
 * Paso 5 — Reasignar el pago recibido a la nueva factura y registrar el
 * ordenante real (la empresa desde la que llegó el depósito).
 */
import { CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import type { PagoRefacturacion } from "@/features/facturacion/domain/refacturacionPasos";
import type { FacturaRefacturacionEstado } from "@/features/facturacion/services/refacturacion";

interface Props {
  pagos: PagoRefacturacion[];
  pagoSeleccionadoId: string | null;
  onSeleccionarPago: (id: string) => void;
  facturaNueva: FacturaRefacturacionEstado | null;
  ordenanteNombre: string;
  onOrdenanteNombre: (v: string) => void;
  ordenanteRfc: string;
  onOrdenanteRfc: (v: string) => void;
  yaReasignado: boolean;
  bloqueoOrdenante: string | null;
}

export function PasoReasignarPago(props: Props) {
  if (props.yaReasignado) {
    return (
      <FormDialogSection title="Pago reasignado" flat>
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
          <span>
            El pago ya quedó aplicado a <strong>{props.facturaNueva?.numero ?? "la nueva factura"}</strong>{" "}
            y el movimiento bancario se conservó conciliado. Cierra el caso para terminar.
          </span>
        </div>
      </FormDialogSection>
    );
  }

  return (
    <div className="space-y-5">
      <FormDialogSection
        title="Pago a mover"
        description="Se dará de baja en la factura original y se volverá a crear en la nueva, arrastrando el movimiento bancario."
        flat
      >
        {props.pagos.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay pagos vivos en la factura original.</p>
        )}
        <ul className="space-y-2">
          {props.pagos.map((p) => {
            const activo = props.pagoSeleccionadoId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => props.onSeleccionarPago(p.id)}
                  aria-pressed={activo}
                  className={`w-full text-left rounded-md border p-3 transition-colors ${
                    activo ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {formatCurrency(Number(p.monto), p.moneda)}
                    </span>
                    <Badge variant="outline">{formatFechaEs(p.fecha_pago)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aplicado a la factura: {formatCurrency(Number(p.monto_aplicado_factura ?? 0), p.moneda)}
                    {p.uuid_rep ? " · REP cancelado" : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </FormDialogSection>

      <FormDialogSection
        title="Ordenante real del depósito"
        description="Obligatorio: deja constancia de la empresa desde la que llegó el dinero."
        cols={2}
      >
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-ordenante">Empresa que pagó</Label>
          <Input
            id="refact-ordenante"
            value={props.ordenanteNombre}
            onChange={(e) => props.onOrdenanteNombre(e.target.value)}
            placeholder="Razón social del ordenante"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-label" htmlFor="refact-ordenante-rfc">RFC del ordenante</Label>
          <Input
            id="refact-ordenante-rfc"
            value={props.ordenanteRfc}
            onChange={(e) => props.onOrdenanteRfc(e.target.value.toUpperCase())}
            placeholder="XAXX010101000"
          />
        </div>
        {props.bloqueoOrdenante && (
          <p className="md:col-span-2 text-xs text-destructive">{props.bloqueoOrdenante}</p>
        )}
      </FormDialogSection>

      <div className="rounded-md border border-info/30 bg-info/5 p-3 text-xs">
        Destino: <strong>{props.facturaNueva?.numero ?? "—"}</strong>. Se valida que la moneda
        coincida y que el pago no exceda el saldo de la nueva factura.
      </div>
    </div>
  );
}
