/**
 * Ola 2 — Descargas del estado de cuenta del proveedor (CSV y PDF).
 * Aísla los efectos de descarga fuera del componente.
 */
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { cargarEmisorEntidad } from "@/pdf/emisor";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import {
  estadoCuentaACsv,
  filasAgingExport,
  filasAperturaExport,
  filasMovimientosExport,
  filasSaldosExport,
  nombreArchivoEstadoCuenta,
} from "@/features/proveedor/services/estadoCuentaExport";
import type {
  AgingMonedaProveedor,
  MovimientoConSaldo,
  SaldoMonedaProveedor,
  SaldoAperturaProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";

export interface DatosEstadoCuenta {
  proveedorId: string;
  proveedorNombre: string;
  rfc?: string | null;
  desde: string;
  hasta: string;
  movimientos: MovimientoConSaldo[];
  aging: AgingMonedaProveedor[];
  saldos: SaldoMonedaProveedor[];
  saldoApertura?: SaldoAperturaProveedor[];
  hayMas?: boolean;
  totalMovimientos?: number;
}

function sinDatos(): void {
  notifyWarning(undefined, {
    title: "Sin movimientos para exportar",
    description: "No hay facturas, pagos ni notas de crédito en el periodo seleccionado.",
  });
}

/** AUD113: un periodo sin movimientos puede tener una apertura conciliable. */
function tieneApertura(datos: DatosEstadoCuenta): boolean {
  return datos.saldoApertura?.some((s) => Math.abs(s.saldo) > 0.005) ?? false;
}

function tieneAging(datos: DatosEstadoCuenta): boolean {
  return datos.aging.some((a) => (Number(a.total) || 0) > 0.005);
}

export function descargarEstadoCuentaCsv(datos: DatosEstadoCuenta): void {
  const movs = filasMovimientosExport(datos.movimientos);
  const aging = filasAgingExport(datos.aging);
  if (movs.length === 0 && !tieneAging(datos) && !tieneApertura(datos)) return sinDatos();
  try {
    const csv = estadoCuentaACsv(
      datos.proveedorNombre,
      { desde: datos.desde, hasta: datos.hasta },
      movs,
      filasSaldosExport(datos.saldos),
      { aging, apertura: filasAperturaExport(datos.saldoApertura ?? []) },
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    descargarBlob(blob, nombreArchivoEstadoCuenta(datos.proveedorNombre, datos.hasta, "csv"));
    notifySuccess(undefined, {
      title: "Estado de cuenta descargado en CSV",
      description: movs.length > 0 ? `${movs.length} movimiento(s)` : "Saldos sin movimientos en el periodo",
    });
  } catch (error) {
    notifyError(undefined, {
      title: "No se pudo generar el CSV",
      error,
      method: "PROVEEDOR_ESTADO_CUENTA_CSV",
    });
  }
}

export async function descargarEstadoCuentaPdf(datos: DatosEstadoCuenta): Promise<void> {
  const scope = captureAuthOperationScope();
  const movs = filasMovimientosExport(datos.movimientos);
  if (movs.length === 0 && !tieneAging(datos) && !tieneApertura(datos)) return sinDatos();
  try {
    const [{ descargarPdf }, { EstadoCuentaProveedorDocument }, emisor] = await Promise.all([
      import("@/pdf/render/descargarPdf"),
      import("@/pdf/documents/EstadoCuentaProveedorDocument"),
      cargarEmisorEntidad("proveedores", datos.proveedorId),
    ]);
    scope.assertCurrent();
    await descargarPdf(
      <EstadoCuentaProveedorDocument
        proveedorNombre={datos.proveedorNombre}
        emisor={emisor}
        rfc={datos.rfc}
        desde={datos.desde}
        hasta={datos.hasta}
        movimientos={movs}
        aging={filasAgingExport(datos.aging)}
        saldos={filasSaldosExport(datos.saldos)}
        saldoApertura={(datos.saldoApertura ?? []).map((s) => ({
          moneda: s.moneda, saldo: String(s.saldo),
        }))}
        hayMas={datos.hayMas}
        totalMovimientos={datos.totalMovimientos}
      />,
      nombreArchivoEstadoCuenta(datos.proveedorNombre, datos.hasta, "pdf"),
    );
    notifySuccess(undefined, { title: "Estado de cuenta descargado en PDF" });
  } catch (error) {
    notifyError(undefined, {
      title: "No se pudo generar el PDF",
      error,
      method: "PROVEEDOR_ESTADO_CUENTA_PDF",
    });
  }
}
