/**
 * Ola 2 — Descargas del estado de cuenta del proveedor (CSV y PDF).
 * Aísla los efectos de descarga fuera del componente.
 */
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import {
  estadoCuentaACsv,
  filasAgingExport,
  filasMovimientosExport,
  filasSaldosExport,
  nombreArchivoEstadoCuenta,
} from "@/features/proveedor/services/estadoCuentaExport";
import type {
  AgingMonedaProveedor,
  MovimientoConSaldo,
  SaldoMonedaProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";

export interface DatosEstadoCuenta {
  proveedorNombre: string;
  rfc?: string | null;
  desde: string;
  hasta: string;
  movimientos: MovimientoConSaldo[];
  aging: AgingMonedaProveedor[];
  saldos: SaldoMonedaProveedor[];
}

function sinDatos(): void {
  notifyWarning(undefined, {
    title: "Sin movimientos para exportar",
    description: "No hay facturas, pagos ni notas de crédito en el periodo seleccionado.",
  });
}

/** R3P-11: un estado de cuenta sin movimientos del periodo pero con saldo en
 * antigüedad SÍ se puede exportar: es el documento que se usa para conciliar. */
function tieneAging(datos: DatosEstadoCuenta): boolean {
  return datos.aging.some((a) => (Number(a.total) || 0) > 0.005);
}

export function descargarEstadoCuentaCsv(datos: DatosEstadoCuenta): void {
  const movs = filasMovimientosExport(datos.movimientos);
  const aging = filasAgingExport(datos.aging);
  if (movs.length === 0 && !tieneAging(datos)) return sinDatos();
  try {
    const csv = estadoCuentaACsv(
      datos.proveedorNombre,
      { desde: datos.desde, hasta: datos.hasta },
      movs,
      filasSaldosExport(datos.saldos),
      aging,
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    descargarBlob(blob, nombreArchivoEstadoCuenta(datos.proveedorNombre, datos.hasta, "csv"));
    notifySuccess(undefined, {
      title: "Estado de cuenta descargado en CSV",
      description: movs.length > 0 ? `${movs.length} movimiento(s)` : "Sólo antigüedad de saldos",
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
  const movs = filasMovimientosExport(datos.movimientos);
  if (movs.length === 0 && !tieneAging(datos)) return sinDatos();
  try {
    const [{ descargarPdf }, { EstadoCuentaProveedorDocument }] = await Promise.all([
      import("@/pdf/render/descargarPdf"),
      import("@/pdf/documents/EstadoCuentaProveedorDocument"),
    ]);
    await descargarPdf(
      <EstadoCuentaProveedorDocument
        proveedorNombre={datos.proveedorNombre}
        rfc={datos.rfc}
        desde={datos.desde}
        hasta={datos.hasta}
        movimientos={movs}
        aging={filasAgingExport(datos.aging)}
        saldos={filasSaldosExport(datos.saldos)}
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
