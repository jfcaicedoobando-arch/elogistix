/**
 * `<PdfObjectViewer />` — visor incrustado de PDF tolerante a bloqueos.
 *
 * Usa `<object type="application/pdf">`: si la política del navegador o una
 * extensión impide el visor incrustado, se muestra el contenido de respaldo
 * con acciones para abrir en pestaña nueva o descargar.
 *
 * v13.388.0 — el PDF se abre ajustado al ancho (`#view=FitH&zoom=page-width`)
 * y sin barra de miniaturas, para que no se vea diminuto en paneles angostos.
 */
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { urlPdfConVista, VISTA_PDF_ANCHO } from "@/lib/pdf/blobPdfUrl";

interface Props {
  url: string;
  title: string;
  /** Nombre sugerido al descargar desde el respaldo. */
  nombreArchivo?: string;
  className?: string;
  /** Parámetros de vista del visor nativo. `null` para no agregar ninguno. */
  vista?: string | null;
}

export function PdfObjectViewer({
  url,
  title,
  nombreArchivo,
  className,
  vista = VISTA_PDF_ANCHO,
}: Props) {
  const data = vista ? urlPdfConVista(url, vista) : url;
  return (
    <object data={data} type="application/pdf" title={title} className={className ?? "h-full w-full"}>
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Tu navegador bloqueó la vista previa incrustada del PDF. Ábrelo en una pestaña nueva o
          descárgalo para revisarlo.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden /> Abrir en pestaña nueva
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href={url} download={nombreArchivo ?? "documento.pdf"}>
              <Download className="mr-2 h-4 w-4" aria-hidden /> Descargar
            </a>
          </Button>
        </div>
      </div>
    </object>
  );
}
