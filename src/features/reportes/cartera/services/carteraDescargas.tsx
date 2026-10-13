/**
 * Descargas del reporte de Cartera y Antigüedad (CSV y PDF).
 * Aísla los efectos de descarga fuera de la pantalla para respetar el
 * límite de tamaño de componentes.
 */
import { todayLocalISO } from "@/lib/date/today";
import { descargarBlob } from "@/lib/downloadBlob";
import { fetchEmisorReporte } from "@/features/configuracion/services/emisorPdf";
import { LEYENDA_VALUACION_EUR } from "../domain/carteraLeyendas";
import { assertCarteraScopeCurrent, type CarteraDataScope } from "./carteraSnapshot";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import {
  carteraACsv,
  filasCarteraExport,
  filasTotalesExport,
  nombreArchivoCartera,
  type FilaCarteraExport,
} from "@/features/reportes/cartera/services/carteraExport";
import type {
  FilaCartera,
  TotalBucket,
  TotalesCartera,
} from "@/features/reportes/cartera/domain/agingCartera";

export interface BloqueCartera {
  titulo: string;
  filas: FilaCartera[];
  buckets: TotalBucket[];
  total: TotalesCartera;
}

function assertCorteActual(fechaCorte: string): void {
  if (fechaCorte !== todayLocalISO()) {
    throw new Error("Cambió el día del reporte. Espera a que se actualice la cartera y vuelve a exportar.");
  }
}

function armarFilas(bloques: readonly BloqueCartera[]): FilaCarteraExport[] {
  return bloques.flatMap((b) => filasCarteraExport(b.titulo, b.filas));
}

export function descargarCarteraCsv(fechaCorte: string, bloques: readonly BloqueCartera[], dataScope: CarteraDataScope, busqueda = ""): void {
  const detalle = armarFilas(bloques);
  if (detalle.length === 0) {
    notifyWarning(undefined, {
      title: "Sin datos para exportar",
      description: "No hay facturas con saldo en la fecha de corte seleccionada.",
    });
    return;
  }
  try {
    assertCarteraScopeCurrent(dataScope);
    assertCorteActual(fechaCorte);
    const csv = carteraACsv(
      detalle,
      bloques.map((b) => ({
        bloque: b.titulo,
        filas: filasTotalesExport(b.buckets, b.total, b.titulo),
      })),
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    descargarBlob(blob, nombreArchivoCartera(fechaCorte, "csv", !!busqueda.trim()));
    notifySuccess(undefined, {
      title: "Cartera descargada en CSV",
      description: `${detalle.length} fila(s) de detalle`,
    });
  } catch (error) {
    notifyError(undefined, {
      title: "No se pudo generar el CSV",
      error,
      method: "CARTERA_AGING_CSV",
    });
  }
}

export async function descargarCarteraPdf(
  fechaCorte: string,
  leyendaTc: string,
  bloques: readonly BloqueCartera[],
  dataScope: CarteraDataScope,
  opciones: { busqueda?: string; sigueVigente?: () => boolean; signal?: AbortSignal } = {},
): Promise<void> {
  const { busqueda = "", sigueVigente = () => true, signal } = opciones;
  // El loader de identidad y toBlob no aceptan señales: se descartan sus
  // continuaciones, sin afirmar que se interrumpe el trabajo ya iniciado.
  const cancelado = () => signal?.aborted || !sigueVigente();
  try {
    if (cancelado()) return;
    assertCarteraScopeCurrent(dataScope);
    assertCorteActual(fechaCorte);
    const [{ pdf }, { ReporteCarteraDocument }, emisor] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/pdf/documents/ReporteCarteraDocument"),
      fetchEmisorReporte(dataScope.organizationId),
    ]);
    if (cancelado()) return;
    assertCarteraScopeCurrent(dataScope);
    assertCorteActual(fechaCorte);
    const blob = await pdf(
      <ReporteCarteraDocument
        fechaCorte={fechaCorte}
        leyendaTc={leyendaTc}
        leyendaValuacion={LEYENDA_VALUACION_EUR}
        busqueda={busqueda}
        emisor={emisor}
        bloques={bloques.map((b) => ({
          titulo: b.titulo,
          totales: filasTotalesExport(b.buckets, b.total, b.titulo),
          facturas: filasCarteraExport(b.titulo, b.filas),
        }))}
      />,
    ).toBlob();
    if (cancelado()) return;
    assertCarteraScopeCurrent(dataScope);
    assertCorteActual(fechaCorte);
    descargarBlob(blob, nombreArchivoCartera(fechaCorte, "pdf", !!busqueda.trim()));
    notifySuccess(undefined, { title: "Cartera descargada en PDF" });
  } catch (error) {
    if (cancelado()) return;
    notifyError(undefined, {
      title: "No se pudo generar el PDF",
      error,
      method: "CARTERA_AGING_PDF",
    });
  }
}

