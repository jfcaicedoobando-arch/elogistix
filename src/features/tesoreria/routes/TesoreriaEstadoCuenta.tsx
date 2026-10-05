import { useDocumentTitle } from "@/hooks/shared/useDocumentTitle";
/**
 * Tesorería › Estado de cuenta bancario (v13.450.0).
 *
 * Extracto tipo banco: saldo inicial del periodo, movimientos cronológicos con
 * saldo corrido, filtros por fecha/concepto/tipo y exportación a CSV/PDF.
 */
import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { CuentasBancariasEmptyState } from "@/features/tesoreria/components/CuentasBancariasEmptyState";
import { Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { DataTable } from "@/components/shared/DataTable";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useEstadoCuenta } from "@/features/tesoreria/hooks/useEstadoCuenta";
import {
  filtrarMovimientos, rangoMes,
  type RangoFechas, type TipoMovimientoEstadoCuenta,
} from "@/features/tesoreria/domain/estadoCuenta";
import { DetallePagoSheet } from "@/features/tesoreria/components/DetallePagoSheet";
import type { RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { estadoCuentaColumns } from "./_sections/estadoCuentaColumns";
import { EstadoCuentaToolbar } from "./_sections/EstadoCuentaToolbar";
import { EstadoCuentaResumen } from "./_sections/EstadoCuentaResumen";
import { EstadoCuentaMovimientosResumen } from "./_sections/EstadoCuentaMovimientosResumen";
import { EstadoCuentaExportButtons } from "./_sections/EstadoCuentaExportButtons";

function cuentasListas(cargando: boolean, error: boolean, cantidad: number) {
  return !cargando && !error && cantidad > 0;
}

export default function TesoreriaEstadoCuenta() {
  useDocumentTitle("Estado de cuenta");
  const { data: cuentas = [], isLoading: cargandoCuentas, isError: errorCuentas, refetch: recargarCuentas } = useCuentasBancarias();
  const { canAdminCuentasBancarias } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cuentaId, setCuentaIdState] = useState<string>(searchParams.get("cuenta") ?? "");
  const [rango, setRango] = useState<RangoFechas>(() => rangoMes());
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoMovimientoEstadoCuenta>("todos");
  const [refPago, setRefPago] = useState<RefPago | null>(null);

  const setCuentaId = (id: string) => {
    setCuentaIdState(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("cuenta", id); else next.delete("cuenta");
      return next;
    }, { replace: true });
  };

  const { data: estado, isLoading, isError, refetch } = useEstadoCuenta(
    cuentaId || null, rango.desde, rango.hasta,
  );

  const moneda = estado?.moneda ?? cuentas.find((c) => c.id === cuentaId)?.moneda ?? "MXN";
  const columns = useMemo(() => estadoCuentaColumns(moneda, setRefPago), [moneda]);
  const visibles = useMemo(
    () => filtrarMovimientos(estado?.movimientos ?? [], { texto, tipo }),
    [estado, texto, tipo],
  );
  const sinCobertura = estado?.cobertura_historica === "sin_cobertura";

  return (
    <PageContainer>
      <PageHeader
        title="Estado de cuenta"
        description="Historial de entradas y salidas con saldo corrido, como el extracto del banco"
        actions={
          estado ? <EstadoCuentaExportButtons estado={estado} movimientos={visibles} filtros={{ texto, tipo }} /> : undefined
        }
      />

      {!cuentasListas(cargandoCuentas, errorCuentas, cuentas.length) ? (
        <AsyncBoundary isLoading={cargandoCuentas} isError={errorCuentas} onRetry={recargarCuentas}
          skeleton={<KpiGridSkeleton count={3} heightClass="h-32" desktopCols={3} />}
          errorTitle="No se pudieron cargar las cuentas bancarias">
          <Card><CardContent density="compact">
            <CuentasBancariasEmptyState puedeAdministrar={canAdminCuentasBancarias}
              onAdministrar={() => navigate("/tesoreria/cuentas")} />
          </CardContent></Card>
        </AsyncBoundary>
      ) : (
        <>
      <EstadoCuentaToolbar
        cuentas={cuentas}
        cuentaId={cuentaId}
        onCuentaChange={setCuentaId}
        rango={rango}
        onRangoChange={setRango}
        texto={texto}
        onTextoChange={setTexto}
        tipo={tipo}
        onTipoChange={setTipo}
      />

      {!cuentaId ? (
        <Card>
          <CardContent density="compact">
            <EmptyStateInline icon={Landmark} message="Selecciona una cuenta para ver su estado de cuenta." />
          </CardContent>
        </Card>
      ) : (
        <>
          <EstadoCuentaResumen estado={estado} isLoading={isLoading} />

          <div className="space-y-1">
            <EstadoCuentaMovimientosResumen estado={estado} visibles={visibles} moneda={moneda} />
            <DataTable
              columns={columns}
              data={visibles}
              rowKey={(m) => m.id}
              density={TABLE_DENSITY.listado}
              striped
              stickyHeader
              tableClassName="w-full"
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              emptyMessage={sinCobertura ? "El periodo seleccionado es anterior al arranque de la cuenta. No hay cobertura histórica disponible." : "No hay movimientos en el periodo seleccionado."}
            />

          </div>
        </>
      )}

        </>
      )}

      {refPago ? (
        <DetallePagoSheet
          ref_pago={refPago}
          onOpenChange={(open) => { if (!open) setRefPago(null); }}
        />
      ) : null}
    </PageContainer>
  );
}
