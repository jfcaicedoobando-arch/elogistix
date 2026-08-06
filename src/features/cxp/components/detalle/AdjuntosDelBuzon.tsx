/**
 * Respaldo del buzón CxP: cuando la factura no tiene XML/PDF propios pero el
 * documento del buzón que la originó sí los tiene, se ofrecen desde ahí.
 * v13.427.0
 */
import { ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { abrirFacturaEntrante } from "@/features/cxp/services/facturasEntrantes";
import { notifyError } from "@/lib/ui/appFeedback";
import type { EntranteDeFactura } from "@/features/cxp/hooks/useEntranteDeFactura";

interface Props {
  entrante: EntranteDeFactura;
  faltaPdf: boolean;
  faltaXml: boolean;
}

async function abrir(path: string, nombre: string) {
  try {
    await abrirFacturaEntrante(path, nombre);
  } catch (e) {
    notifyError(undefined, {
      title: "No se pudo abrir el archivo del buzón",
      error: e,
      method: "CXP_DOCUMENTOS_BUZON_FALLBACK",
    });
  }
}

export function AdjuntosDelBuzon({ entrante, faltaPdf, faltaXml }: Props) {
  const pdfPath =
    entrante.archivo_path && !entrante.archivo_path.toLowerCase().endsWith(".xml")
      ? entrante.archivo_path
      : null;
  const mostrarPdf = faltaPdf && Boolean(pdfPath);
  const mostrarXml = faltaXml && Boolean(entrante.xml_path);
  if (!mostrarPdf && !mostrarXml) return null;

  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3 space-y-2">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" /> Documento del buzón
      </p>
      <div className="flex flex-wrap gap-2">
        {mostrarPdf && pdfPath && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => abrir(pdfPath, entrante.nombre_archivo ?? "factura.pdf")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir PDF del buzón
          </Button>
        )}
        {mostrarXml && entrante.xml_path && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => abrir(entrante.xml_path!, entrante.xml_nombre ?? "factura.xml")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Descargar XML del buzón
          </Button>
        )}
      </div>
      <p className="text-2xs text-muted-foreground">
        Estos archivos llegaron por el buzón de facturas y aún no se copiaron al
        expediente de la factura.
      </p>
    </div>
  );
}
