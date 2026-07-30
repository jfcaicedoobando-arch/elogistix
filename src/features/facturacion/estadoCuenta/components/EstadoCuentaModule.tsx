/**
 * Shell del módulo Estado de Cuenta — reutilizado por la ruta interna
 * (`/clientes/:clienteId/estado-de-cuenta`) y por el portal cliente
 * (`/portal/estado-de-cuenta`). Recibe los `clienteIds` ya resueltos por el
 * caller (uno en modo interno, varios en portal).
 */
import { useEstadoCuentaVista } from "../hooks/useEstadoCuentaVista";
import { EstadoCuentaKpiCards } from "./EstadoCuentaKpiCards";
import { EstadoCuentaAgingBar } from "./EstadoCuentaAgingBar";
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
  /** Franja de identidad del cliente (sólo modo interno). */
  identidad?: React.ReactNode;
  /** Si es `false`, las acciones de exportación se renderizan fuera (encabezado). */
  mostrarExportaciones?: boolean;
}

export function EstadoCuentaModule({
  clienteIds,
  facturaHrefBase,
  defaultSoloConSaldo = false,
  headerRight,
  identidad,
  mostrarExportaciones = true,
}: Props) {
  const v = useEstadoCuentaVista(clienteIds, defaultSoloConSaldo);
  const facturaHref = (id: string) => `${facturaHrefBase}/${id}`;

  return (
    <div className="space-y-4">
      {(headerRight || mostrarExportaciones) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {headerRight}
          {mostrarExportaciones && (
            <ExportActions
              clienteIds={clienteIds}
              rows={v.filtradas}
              desde={v.desde}
              hasta={v.hasta}
            />
          )}
        </div>
      )}

      {identidad}

      <EstadoCuentaKpiCards kpis={v.kpis} loading={v.isLoading} />

      <EstadoCuentaAgingBar buckets={v.aging} activo={v.bucket} onToggle={v.toggleBucket} />

      <EstadoCuentaTable
        grupos={v.grupos}
        isLoading={v.isLoading}
        facturaHref={facturaHref}
        sort={v.sort}
        onSort={v.onSort}
        restantes={v.restantes}
        onVerMas={v.verMas}
        toolbar={
          <EstadoCuentaFilters
            presetActivo={v.presetActivo}
            onPreset={v.aplicarPreset}
            soloConSaldo={v.soloConSaldo}
            onSoloConSaldoChange={v.setSoloConSaldo}
            moneda={v.moneda}
            onMonedaChange={v.setMoneda}
            busqueda={v.busqueda}
            onBusquedaChange={v.setBusqueda}
          />
        }
      />
    </div>
  );
}
