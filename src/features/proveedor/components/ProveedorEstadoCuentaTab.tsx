/**
 * Ola 2 — Pestaña "Estado de cuenta" del proveedor: antigüedad de saldos,
 * movimientos cronológicos con saldo corrido y exportación CSV/PDF.
 */
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { CardSkeleton } from "@/components/shared/skeletons";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { formatCurrency } from "@/lib/formatters";
import { useProveedorMovimientos } from "@/features/proveedor/hooks/useProveedorMovimientos";
import {
  agingPorMoneda, conSaldoCorrido, filtrarPorRango,
} from "@/features/proveedor/domain/movimientosProveedor";
import {
  descargarEstadoCuentaCsv, descargarEstadoCuentaPdf,
} from "@/features/proveedor/services/estadoCuentaDescargas";
import { ProveedorAgingCard } from "./ProveedorAgingCard";
import { ProveedorMovimientosTable } from "./ProveedorMovimientosTable";

interface Props {
  proveedorId: string;
  proveedorNombre: string;
  rfc?: string | null;
}

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoHaceUnAnio(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function ProveedorEstadoCuentaTab({ proveedorId, proveedorNombre, rfc }: Props) {
  const [desde, setDesde] = useState(isoHaceUnAnio);
  const [hasta, setHasta] = useState(isoHoy);
  const [descargando, setDescargando] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } =
    useProveedorMovimientos(proveedorId, desde, hasta);

  const movimientos = useMemo(
    () => conSaldoCorrido(filtrarPorRango(data?.movimientos ?? [], desde, hasta)),
    [data?.movimientos, desde, hasta],
  );
  const aging = useMemo(() => agingPorMoneda(data?.aging ?? []), [data?.aging]);
  const saldos = data?.saldos ?? [];

  const datosExport = { proveedorNombre, rfc, desde, hasta, movimientos, aging, saldos };

  const handlePdf = async () => {
    setDescargando(true);
    try {
      await descargarEstadoCuentaPdf(datosExport);
    } finally {
      setDescargando(false);
    }
  };

  if (isLoading) return <CardSkeleton />;

  // R3FE-05 (Ola 12): un fallo de la RPC NO debe pintarse como "sin movimientos".
  if (isError) {
    return (
      <ErrorStateInline
        title="No pudimos cargar el estado de cuenta"
        message={error instanceof Error ? error.message : "Error desconocido al consultar la información."}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent density="compact" className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Desde</p>
            <DatePickerMx value={desde} onChange={setDesde} max={hasta} aria-label="Fecha inicial del estado de cuenta" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Hasta</p>
            <DatePickerMx value={hasta} onChange={setHasta} min={desde} aria-label="Fecha final del estado de cuenta" />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => descargarEstadoCuentaCsv(datosExport)}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={descargando}
              onClick={handlePdf}
            >
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProveedorAgingCard aging={aging} />

      {saldos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Saldos por moneda</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            {saldos.map((s) => (
              <div key={s.moneda}>
                <p className="text-xs text-muted-foreground">
                  {s.moneda} · saldo global · cargos {formatCurrency(s.cargos, s.moneda)} ·{" "}
                  abonos{" "}
                  {formatCurrency(s.abonos, s.moneda)}
                </p>
                <p className="text-kpi font-semibold tabular-nums">
                  {formatCurrency(s.saldo, s.moneda)}
                </p>
              </div>
            ))}
            <p className="w-full text-xs text-muted-foreground">
              Saldo global al día de hoy (sin filtro de periodo); cuadra contra la antigüedad de
              saldos.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Movimientos
            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
              {movimientos.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {data?.hay_mas && (
            <p className="px-4 pt-3 text-xs text-warning">
              Mostrando los {movimientos.length} movimientos más recientes del periodo
              (total: {data.total_movimientos}). Acota el rango de fechas para ver el resto.
            </p>
          )}
          <ProveedorMovimientosTable movimientos={movimientos} />
        </CardContent>
      </Card>
    </div>
  );
}
