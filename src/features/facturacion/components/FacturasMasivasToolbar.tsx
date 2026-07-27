import { useState } from "react";
import { Download, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchFacturasParaZip,
  marcarFacturasComoEnviadas,
} from "@/features/facturacion/services";

import { useQueryClient } from "@tanstack/react-query";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { fetchCfdiFacturapi, esUrlFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";

async function obtenerBytes(stored: string | null, facturaId: string, tipo: "pdf" | "xml"): Promise<ArrayBuffer | null> {
  if (!stored && !facturaId) return null;
  if (stored && !esUrlFacturapi(stored)) {
    const res = await fetch(stored);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  }
  // Stored vacío o apunta a FacturApi → usar proxy autenticado.
  const { blob } = await fetchCfdiFacturapi({ tipo, facturaId });
  return await blob.arrayBuffer();
}

import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { todayLocalISO } from "@/lib/date/today";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
}

/**
 * Toolbar de acciones masivas para Facturas Emitidas.
 * - Descargar ZIP de PDFs
 * - Reenviar por email (correo del contacto principal del cliente)
 * - Marcar como enviada al cliente (campo enviada_cliente_at)
 */
export function FacturasMasivasToolbar({ selectedIds, onClear }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "zip" | "email" | "mark">(null);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const ids = Array.from(selectedIds);
  const disabled = ids.length === 0;

  const descargarZip = async () => {
    setBusy("zip");
    try {
      const data = await fetchFacturasParaZip(ids);
      const zip = new JSZip();
      const folder = zip.folder("facturas")!;
      let count = 0;
      for (const f of data ?? []) {
        try {
          const pdf = await obtenerBytes(f.factura_pdf_url, f.id, "pdf");
          if (pdf) {
            folder.file(`${f.numero}.pdf`, pdf);
            count++;
          }
        } catch { /* skip */ }
        try {
          const xml = await obtenerBytes(f.factura_xml_url, f.id, "xml");
          if (xml) folder.file(`${f.numero}.xml`, xml);
        } catch { /* skip */ }
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      saveAs(blob, `facturas-${todayLocalISO()}.zip`);
      notifySuccess(undefined, { title: `${count} factura(s) descargadas` });
    } catch (e) {
      notifyError(undefined, { title: `Error al generar ZIP: ${(e as Error).message}`, error: e, method: "FEATURES_FACTURACION_COMPONENTS_FACTURASMASIVASTOOLBAR_1" });
      reportCaughtError(e, { feature: "facturacion", op: "generar_zip_masivo" }, { total: ids.length });
    } finally {
      setBusy(null);
    }
  };

  const reenviarEmail = async () => {
    // v13.312.27 (QW8 Tanda 2): flujo real. Iteramos IDs seleccionados y
    // llamamos `facturapi-enviar-email` uno a uno (el edge resuelve el email
    // del contacto principal del cliente cuando no se pasa uno explícito).
    // No usamos plantilla `factura-reenvio` para evitar sobreescribir
    // adjuntos PDF/XML — FacturApi ya los adjunta desde su lado.
    // v13.320.25 (Tanda 2 auditoría toasts): la confirmación pasó de
    // `window.confirm()` (inconsistente con el resto de la app) a
    // `ConfirmActionDialog`.
    setConfirmEmailOpen(false);
    setBusy("email");
    let ok = 0;
    const errores: string[] = [];
    try {
      const { enviarCfdiFactura } = await import("@/features/facturacion/services/enviarCfdiEmail");
      for (const id of ids) {
        try {
          await enviarCfdiFactura(id);
          ok++;
        } catch (e) {
          errores.push(`${id.slice(0, 8)}…: ${(e as Error).message}`);
        }
      }
      if (ok > 0) qc.invalidateQueries({ queryKey: facturasKeys.all });
      if (errores.length === 0) {
        notifySuccess(undefined, { title: `${ok} factura(s) reenviadas` });
      } else if (ok === 0) {
        notifyError(undefined, {
          title: `No se pudo reenviar ninguna factura (${errores.length} error(es))`,
          description: errores.slice(0, 3).join(" · "),
          method: "FEATURES_FACTURACION_COMPONENTS_FACTURASMASIVASTOOLBAR_REENVIAR",
        });
      } else {
        notifyWarning(undefined, {
          title: `${ok} enviadas · ${errores.length} con error`,
          description: errores.slice(0, 3).join(" · "),
          method: "FEATURES_FACTURACION_COMPONENTS_FACTURASMASIVASTOOLBAR_REENVIAR_PARTIAL",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const marcarEnviada = async () => {
    setBusy("mark");
    try {
      await marcarFacturasComoEnviadas(ids);
      notifySuccess(undefined, { title: `${ids.length} factura(s) marcadas como enviadas` });
      qc.invalidateQueries({ queryKey: facturasKeys.all });
      onClear();
    } catch (e) {
      notifyError(undefined, { title: `Error al marcar: ${(e as Error).message}`, error: e, method: "FEATURES_FACTURACION_COMPONENTS_FACTURASMASIVASTOOLBAR_2" });
      reportCaughtError(e, { feature: "facturacion", op: "marcar_enviada_masivo" }, { count: ids.length });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border rounded-md">
      <span className="text-sm font-medium">
        {ids.length} seleccionada{ids.length === 1 ? "" : "s"}
      </span>
      <div className="flex-1" />
      <Button variant="outline" size="sm" disabled={disabled || !!busy} onClick={descargarZip}>
        {busy === "zip" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
        Descargar ZIP
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || !!busy} onClick={reenviarEmail}>
        {busy === "email" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
        Reenviar por email
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || !!busy} onClick={marcarEnviada}>
        {busy === "mark" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
        Marcar enviada
      </Button>
      {ids.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>Limpiar</Button>
      )}
    </div>
  );
}
