/**
 * Helper unificado para descargas CSV con feedback consistente al usuario.
 *
 * v13.320.25 — Tanda 1 auditoría toasts. Antes: cada página con "Exportar CSV"
 * generaba el archivo en silencio (o hacía early-return si no había filas), lo
 * que dejaba al usuario sin saber si el clic funcionó. Ahora:
 *   - `rowCount === 0` → `notifyWarning` y NO descarga.
 *   - `rowCount > 0`   → genera la descarga y muestra `notifySuccess`.
 *
 * Todo pasa por `@/lib/ui/appFeedback` para respetar el guardrail
 * `no-direct-sonner`.
 */
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";

interface Args {
  /** Nombre completo del archivo (incluye extensión .csv). */
  filename: string;
  /** Contenido CSV ya serializado (headers + filas). */
  csv: string;
  /** Cantidad de filas de datos (sin contar el header). */
  rowCount: number;
  /** Copy opcional para el toast de warning cuando no hay filas. */
  emptyWarning?: { title?: string; description?: string };
}

export function downloadCsvWithFeedback({ filename, csv, rowCount, emptyWarning }: Args): void {
  if (rowCount <= 0) {
    notifyWarning(undefined, {
      title: emptyWarning?.title ?? "Sin datos para exportar",
      description:
        emptyWarning?.description ??
        "Ajusta los filtros e inténtalo de nuevo — no hay filas visibles.",
    });
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  notifySuccess(undefined, {
    title: "CSV descargado",
    description: `${filename} · ${rowCount} fila(s)`,
  });
}
