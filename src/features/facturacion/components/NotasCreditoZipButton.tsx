/**
 * Descarga masiva de notas de crédito timbradas (PDF + XML) en un solo ZIP.
 * Usa el mismo proxy autenticado de FacturApi que la descarga individual.
 */
import { useState } from "react";
import { Download } from "lucide-react";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { fetchCfdiFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";
import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { todayLocalISO } from "@/lib/date/today";
import type { EstadoNotaCredito } from "@/features/facturacion/hooks";

/** Sólo las notas que ya pasaron por el SAT tienen PDF/XML. */
export const ESTADOS_NC_CON_CFDI: ReadonlySet<EstadoNotaCredito> = new Set(["Timbrada", "Aplicada", "Cancelada"]);

export interface NotaZip { id: string; folio: string | number; estado: EstadoNotaCredito }

const nombreSeguro = (folio: string | number) => String(folio).replace(/[^\w.-]+/g, "_") || "nota";

async function bytes(id: string, tipo: "pdf" | "xml") {
  const { blob } = await fetchCfdiFacturapi({ tipo, notaCreditoId: id });
  return await blob.arrayBuffer();
}

export function NotasCreditoZipButton({ notas }: { notas: ReadonlyArray<NotaZip> }) {
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const descargables = notas.filter((n) => ESTADOS_NC_CON_CFDI.has(n.estado));

  const descargar = async () => {
    const scope = captureAuthOperationScope();
    setProgreso({ hechas: 0, total: descargables.length });
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const folder = zip.folder("notas-de-credito")!;
      const { ok } = await mapWithConcurrency(
        descargables,
        4,
        async (n) => {
          const [pdf, xml] = await Promise.all([bytes(n.id, "pdf").catch(() => null), bytes(n.id, "xml").catch(() => null)]);
          scope.assertCurrent();
          if (pdf) folder.file(`${nombreSeguro(n.folio)}.pdf`, pdf);
          if (xml) folder.file(`${nombreSeguro(n.folio)}.xml`, xml);
          return pdf != null || xml != null;
        },
        (hechas, total) => { if (scope.isCurrent()) setProgreso({ hechas, total }); },
      );
      scope.assertCurrent();
      const count = ok.filter((r) => r.value).length;
      if (count === 0) {
        notifyWarning(undefined, { title: "No se pudo descargar ningún archivo", description: "Intenta de nuevo en unos minutos." });
        return;
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      scope.assertCurrent();
      saveAs(blob, `notas-credito-${todayLocalISO()}.zip`);
      const faltan = descargables.length - count;
      notifySuccess(undefined, {
        title: `${count} nota(s) de crédito descargadas`,
        description: faltan > 0 ? `${faltan} no se pudieron descargar.` : undefined,
      });
    } catch (e) {
      if (!scope.isCurrent() || e instanceof AuthOperationChangedError) return;
      notifyError(undefined, { title: "No se pudo generar el ZIP", error: e, method: "NOTAS_CREDITO_ZIP" });
      reportCaughtError(e, { feature: "facturacion", op: "zip_notas_credito" }, { total: descargables.length });
    } finally {
      setProgreso(null);
    }
  };

  return (
    <Button
      type="button" variant="outline" size="sm" className="h-8"
      disabled={descargables.length === 0 || progreso != null}
      loading={progreso != null}
      onClick={descargar}
    >
      {!progreso && <Download className="h-4 w-4 mr-1" />}
      {progreso ? `Descargando ${progreso.hechas}/${progreso.total}…` : `Descargar ZIP (${descargables.length})`}
    </Button>
  );
}
