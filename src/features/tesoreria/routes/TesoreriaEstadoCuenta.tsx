/**
 * Tesorería › Estado de cuenta bancario (v13.450.0).
 *
 * Extracto tipo banco: saldo inicial del periodo, movimientos cronológicos con
 * saldo corrido, filtros por fecha/concepto/tipo y exportación a CSV/PDF.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { useCuentasBancarias } from "@/features/tesoreria/hooks";
import { useEstadoCuenta } from "@/features/tesoreria/hooks/useEstadoCuenta";
import {
  filtrarMovimientos, rangoMes, totalesVisibles,
  type RangoFechas, type TipoMovimientoEstadoCuenta,
} from "@/features/tesoreria/domain/estadoCuenta";
import { formatCurrency } from "@/lib/formatters";
import { estadoCuentaColumns } from "./_sections/estadoCuentaColumns";
import { EstadoCuentaToolbar } from "./_sections/EstadoCuentaToolbar";
import { EstadoCuentaResumen } from "./_sections/EstadoCuentaResumen";
import { EstadoCuentaExportButtons } from "./_sections/EstadoCuentaExportButtons";

export default function TesoreriaEstadoCuenta() {
  const { data: cuentas = [] } = useCuentasBancarias();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cuentaId, setCuentaIdState] = useState<string>(searchParams.get("cuenta") ?? "");
  const [rango, setRango] = useState<RangoFechas>(() => rangoMes());
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoMovimientoEstadoCuenta>("todos");

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
  const columns = useMemo(() => estadoCuentaColumns(moneda), [moneda]);
  const visibles = useMemo(
    () => filtrarMovimientos(estado?.movimientos ?? [], { texto, tipo }),
    [estado, texto, tipo],
  );
  const totales = useMemo(() => totalesVisibles(visibles), [visibles]);

  return (
    <PageContainer>
      <PageHeader
        title="Estado de cuenta"
        description="Historial de entradas y salidas con saldo corrido, como el extracto del banco"
        actions={
          estado ? <EstadoCuentaExportButtons estado={estado} movimientos={visibles} /> : undefined
        }
      />

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
        <Card><CardContent density="compact" className="p-8 text-center text-muted-foreground">
          <Landmark className="h-12 w-12 mx-auto mb-2 opacity-30" aria-hidden />
          Selecciona una cuenta para ver su estado de cuenta.
        </CardContent></Card>
      ) : (
        <>
          <EstadoCuentaResumen estado={estado} isLoading={isLoading} />

          <div className="space-y-1">
            <div className="flex flex-wrap justify-between gap-2 px-1 text-xs text-muted-foreground">
              <span>
                {visibles.length} de {estado?.movimientos.length ?? 0} movimientos
                {estado ? ` · ${estado.alias}` : ""}
              </span>
              <span className="tabular-nums">
                Entradas visibles {formatCurrency(totales.entradas, moneda)} · Salidas visibles{" "}
                {formatCurrency(totales.salidas, moneda)}
              </span>
            </div>
            <VirtualDataTable
              columns={columns}
              data={visibles}
              rowKey={(m) => m.id}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => void refetch()}
              emptyMessage="No hay movimientos en el periodo seleccionado."
              maxHeight={620}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
