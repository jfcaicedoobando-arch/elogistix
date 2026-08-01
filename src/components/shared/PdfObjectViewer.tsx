/**
 * `<PdfObjectViewer />` — visor incrustado de PDF tolerante a bloqueos.
 *
 * Usa `<object type="application/pdf">`: si la política del navegador o una
 * extensión impide el visor incrustado, se muestra el contenido de respaldo
 * con acciones para abrir en pestaña nueva o descargar.
 */
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  url: string;
  title: string;
  /** Nombre sugerido al descargar desde el respaldo. */
  nombreArchivo?: string;
  className?: string;
}

export function PdfObjectViewer({ url, title, nombreArchivo, className }: Props) {
  return (
    <object data={url} type="application/pdf" title={title} className={className ?? "h-full w-full"}>
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
