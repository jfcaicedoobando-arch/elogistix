/**
 * Descargas del reporte de Cartera y Antigüedad (CSV y PDF).
 * Aísla los efectos de descarga fuera de la pantalla para respetar el
 * límite de tamaño de componentes.
 */
import { descargarBlob } from "@/lib/downloadBlob";
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

function armarFilas(bloques: readonly BloqueCartera[]): FilaCarteraExport[] {
  return bloques.flatMap((b) => filasCarteraExport(b.titulo, b.filas));
}

export function descargarCarteraCsv(fechaCorte: string, bloques: readonly BloqueCartera[]): void {
  const detalle = armarFilas(bloques);
  if (detalle.length === 0) {
    notifyWarning(undefined, {
      title: "Sin datos para exportar",
      description: "No hay facturas con saldo en la fecha de corte seleccionada.",
    });
    return;
  }
  try {
    const csv = carteraACsv(
      detalle,
      bloques.map((b) => ({
        bloque: b.titulo,
        filas: filasTotalesExport(b.buckets, b.total, b.titulo),
      })),
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    descargarBlob(blob, nombreArchivoCartera(fechaCorte, "csv"));
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
): Promise<void> {
  try {
    const [{ descargarPdf }, { ReporteCarteraDocument }] = await Promise.all([
      import("@/pdf/render/descargarPdf"),
      import("@/pdf/documents/ReporteCarteraDocument"),
    ]);
    await descargarPdf(
      <ReporteCarteraDocument
        fechaCorte={fechaCorte}
        leyendaTc={leyendaTc}
        bloques={bloques.map((b) => ({
          titulo: b.titulo,
          totales: filasTotalesExport(b.buckets, b.total, b.titulo),
          facturas: filasCarteraExport(b.titulo, b.filas),
        }))}
      />,
      nombreArchivoCartera(fechaCorte, "pdf"),
    );
    notifySuccess(undefined, { title: "Cartera descargada en PDF" });
  } catch (error) {
    notifyError(undefined, {
      title: "No se pudo generar el PDF",
      error,
      method: "CARTERA_AGING_PDF",
    });
  }
}
