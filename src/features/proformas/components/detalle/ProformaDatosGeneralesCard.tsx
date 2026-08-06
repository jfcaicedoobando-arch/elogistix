/**
 * Card "Datos generales" de la proforma. Muestra sólo lo que NO está ya en el
 * header ni en el historial: vigencia, días de crédito (heredables del
 * cliente), BL Master y folio de factura externa. La fecha de emisión y el
 * ejecutivo viven en el timeline, y el método de pago se define al facturar.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDiasCredito } from "@/lib/formatters";
import {
  resolverDiasCredito,
  vigenciaPlus30,
} from "@/features/proformas/domain/proformaDetalleHelpers";

interface Props {
  fechaEmision: string;
  diasCredito: number | null | undefined;
  diasCreditoCliente: number | null | undefined;
  folioFacturaExterna: string | null | undefined;
  blMaster: string | null | undefined;
}

function Field({
  label,
  value,
  mono = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={mono ? "font-mono font-medium truncate" : "font-medium truncate"}
        title={value}
      >
        {value}
      </p>
      {badge && (
        <Badge variant="outline" className="mt-1 text-2xs font-normal">
          {badge}
        </Badge>
      )}
    </div>
  );
}

export function ProformaDatosGeneralesCard({
  fechaEmision,
  diasCredito,
  diasCreditoCliente,
  folioFacturaExterna,
  blMaster,
}: Props) {
  const credito = resolverDiasCredito(diasCredito, diasCreditoCliente);
  const blMasterValor = blMaster?.trim() || "—";
  const folioValor = folioFacturaExterna?.trim() || "—";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle >Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Vigencia" value={vigenciaPlus30(fechaEmision)} />
        <Field
          label="Días crédito"
          value={formatDiasCredito(credito.dias)}
          badge={credito.heredado ? "Heredado del cliente" : undefined}
        />
        <Field label="BL Master / MAWB" value={blMasterValor} mono />
        <Field label="Folio factura externa" value={folioValor} mono />
      </CardContent>
    </Card>
  );
}
