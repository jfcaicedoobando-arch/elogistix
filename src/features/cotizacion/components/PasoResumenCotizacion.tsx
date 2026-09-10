import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardSection } from "@/components/shared/WizardSection";
import { formatCurrency } from "@/lib/formatters";
import ResumenPL from "@/features/cotizacion/components/ResumenPL";

interface TotalesPL {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

interface Props {
  plUSD: TotalesPL;
  plMXN: TotalesPL;
  tieneCostosUSD: boolean;
  tieneCostosMXN: boolean;
  nombreCliente: string;
  origen: string;
  destino: string;
  numContenedores: number;
  modo: string;
  incoterm: string;
  tipo: string;
  totalUSD: number;
  totalMXN: number;
}

const DATO = (label: string, valor: string) => ({ label, valor });

export default function PasoResumenCotizacion({
  plUSD, plMXN, tieneCostosUSD, tieneCostosMXN,
  nombreCliente, origen, destino, numContenedores,
  modo, incoterm, tipo, totalUSD, totalMXN,
}: Props) {
  const datos = [
    DATO("Cliente", nombreCliente || "—"),
    DATO("Ruta", `${origen || "—"} → ${destino || "—"}`),
    DATO("Contenedores/BLs", String(numContenedores)),
    DATO("Modo", modo || "—"),
    DATO("Incoterm", incoterm || "—"),
    DATO("Tipo", tipo || "—"),
  ];

  return (
    <div className="space-y-6">
      {/* Mismo componente de resumen que el detalle de la cotización: una sola
          forma de presentar costo, venta, utilidad y margen. */}
      <ResumenPL
        totalesUSD={plUSD}
        totalesMXN={plMXN}
        tieneUSD={tieneCostosUSD}
        tieneMXN={tieneCostosMXN}
        mostrarRentabilidadGlobal
        notaPie="El IVA no forma parte de la utilidad"
      />

      <WizardSection title="Datos de la operación" columns={3}>
        {datos.map((d) => (
          <div key={d.label}>
            <span className="text-body-sm text-muted-foreground">{d.label}</span>
            <p className="text-body font-medium">{d.valor}</p>
          </div>
        ))}
      </WizardSection>

      <WizardSection title="Totales de la cotización">
        <div className="flex flex-col items-end gap-1">
          <span className="text-body font-semibold tabular-nums">
            Total USD: {formatCurrency(totalUSD, "USD")}
          </span>
          <span className="text-body font-semibold tabular-nums">
            Total MXN (c/IVA): {formatCurrency(totalMXN, "MXN")}
          </span>
        </div>
      </WizardSection>

      <Alert variant="warning">
        <Info className="h-4 w-4" />
        <AlertDescription>La cotización se guardará en estado Borrador.</AlertDescription>
      </Alert>
    </div>
  );
}
