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
import { FinancialQueryError } from "@/components/shared/FinancialQueryError";

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

function puedeMostrarDatos(isError: boolean, hasData: boolean): boolean {
  return !isError || hasData;
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
          {mostrarExportaciones && !v.isError && !v.isLoading && !v.isFetching && (
            <ExportActions
              clienteIds={clienteIds}
              rows={v.filtradas}
              desde={v.desde}
              hasta={v.hasta}
              moneda={v.moneda}
              soloConSaldo={v.soloConSaldo}
              busqueda={v.busqueda}
              bucket={v.bucket}
            />
          )}
        </div>
      )}

      {identidad}

      {v.kpisIsError && (
        <FinancialQueryError
          title="No se pudieron cargar los totales del estado de cuenta"
          error={v.kpisError}
          onRetry={v.kpisRefetch}
          retrying={v.kpisIsFetching}
          hasPreviousData={v.kpisHasData}
        />
      )}

      {puedeMostrarDatos(v.isError, v.hasData) && puedeMostrarDatos(v.kpisIsError, v.kpisHasData) && (
        <EstadoCuentaKpiCards kpis={v.kpis} loading={v.isLoading || v.kpisIsLoading} />
      )}

      {!v.isLoading && puedeMostrarDatos(v.isError, v.hasData) && (
        <EstadoCuentaAgingBar buckets={v.aging} activo={v.bucket} onToggle={v.toggleBucket} />
      )}

      <EstadoCuentaTable
        grupos={v.grupos}
        isLoading={v.isLoading}
        isError={v.isError}
        error={v.error}
        onRetry={() => void v.refetch()}
        isFetching={v.isFetching}
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

