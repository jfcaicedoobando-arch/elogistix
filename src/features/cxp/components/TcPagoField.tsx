/**
 * Campo "Tipo de cambio" del pago a proveedor (v13.446.0).
 * Se precarga con el DOF de la fecha de pago y queda editable; si el usuario
 * lo modifica, se ofrece el DOF como sugerencia aplicable con un botón.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/formatters";

interface Props {
  tc: string;
  setTc: (v: string) => void;
  tcDof?: { usdMxn: number; fecha: string; exacto: boolean } | null;
  cargandoTcDof?: boolean;
  aplicarTcDof?: () => void;
}

export function TcPagoField({ tc, setTc, tcDof, cargandoTcDof, aplicarTcDof }: Props) {
  const coincide = !!tcDof && Number(tc) === tcDof.usdMxn;

  return (
    <div className="space-y-1">
      <Label htmlFor="tc-pago">Tipo de cambio</Label>
      <Input
        id="tc-pago"
        type="number"
        step="0.0001"
        inputMode="decimal"
        placeholder="0.00"
        className="text-right tabular-nums"
        value={tc}
        onChange={(e) => setTc(e.target.value)}
      />
      {cargandoTcDof && !tcDof && (
        <p className="text-label text-muted-foreground">Consultando DOF…</p>
      )}
      {tcDof && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-label text-muted-foreground">
            DOF del {formatDate(tcDof.fecha)}: {tcDof.usdMxn}
            {tcDof.exacto ? "" : " (último publicado)"}
          </p>
          {!coincide && aplicarTcDof && (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-label" onClick={aplicarTcDof}>
              Usar DOF
            </Button>
          )}
        </div>
      )}
      {!tcDof && !cargandoTcDof && (
        <p className="text-label text-muted-foreground">
          Sin publicación DOF disponible: se usa el tipo de cambio de la factura.
        </p>
      )}
    </div>
  );
}
