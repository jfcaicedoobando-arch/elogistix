/**
 * Shell del módulo Estado de Cuenta — reutilizado por la ruta interna
 * (`/facturacion/clientes/:clienteId/estado-de-cuenta`) y por el portal
 * cliente (`/portal/estado-de-cuenta`). Recibe los `clienteIds` ya resueltos
 * por el caller (uno en modo interno, varios en portal).
 */
import { useState, useMemo } from "react";
import { useEstadoCuenta } from "../hooks/useEstadoCuenta";
import { useEstadoCuentaDateRange } from "../hooks/useEstadoCuentaDateRange";
import { EstadoCuentaKpiCards } from "./EstadoCuentaKpiCards";
import { EstadoCuentaFilters } from "./EstadoCuentaFilters";
import { EstadoCuentaTable } from "./EstadoCuentaTable";
import { ExportActions } from "./ExportActions";

interface Props {
  clienteIds: string[];
  /** Base de la URL de detalle de factura (portal vs interno). */
  facturaHrefBase: string;
  /** default: portal=true, interno=false */
  defaultSoloConSaldo?: boolean;
  headerRight?: React.ReactNode;
}

export function EstadoCuentaModule({
  clienteIds,
  facturaHrefBase,
  defaultSoloConSaldo = false,
  headerRight,
}: Props) {
  const { desde, hasta, presetActivo, aplicarPreset } = useEstadoCuentaDateRange("30d");
  const [soloConSaldo, setSoloConSaldo] = useState(defaultSoloConSaldo);
  const [moneda, setMoneda] = useState<"MXN" | "USD" | "todas">("todas");

  const filters = useMemo(
    () => ({
      clienteIds,
      desde,
      hasta,
      moneda,
      soloConSaldo,
    }),
    [clienteIds, desde, hasta, moneda, soloConSaldo],
  );

  const { rows, kpis, isLoading } = useEstadoCuenta(filters);

  const facturaHref = (id: string) => `${facturaHrefBase}/${id}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {headerRight}
        <ExportActions clienteIds={clienteIds} rows={rows} />
      </div>

      <EstadoCuentaKpiCards kpis={kpis} loading={isLoading} />

      <EstadoCuentaFilters
        presetActivo={presetActivo}
        onPreset={aplicarPreset}
        soloConSaldo={soloConSaldo}
        onSoloConSaldoChange={setSoloConSaldo}
        moneda={moneda}
        onMonedaChange={setMoneda}
      />

      <EstadoCuentaTable rows={rows} isLoading={isLoading} facturaHref={facturaHref} />
    </div>
  );
}
