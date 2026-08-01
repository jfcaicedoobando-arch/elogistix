/**
 * `<DocumentPreviewDialog />` — visor genérico de documentos (PDF/imagen)
 * sobre `Dialog` base.
 *
 * Recibe `url` (blob o remota); las descargas explícitas se manejan afuera
 * vía `descargarBlob`.
 */
import { Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { cn } from "@/lib/utils";
import { PdfObjectViewer } from "@/components/shared/PdfObjectViewer";

export interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** URL del PDF/imagen a mostrar. */
  url: string | null;
  /** Handler opcional de descarga; si se omite se muestra el botón "Cerrar" solo. */
  onDownload?: () => void;
  downloadLabel?: string;
  className?: string;
}

function isImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  url,
  onDownload,
  downloadLabel = "Descargar",
  className,
}: DocumentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(dialogSize.xl, "max-h-[90vh] flex flex-col gap-0 p-0", className)}
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-muted/30">
          {url ? (
            isImage(url) ? (
              <img
                src={url}
                alt={title}
                className="mx-auto max-h-full max-w-full object-contain"
              />
            ) : (
              <PdfObjectViewer url={url} title={title} className="h-[70vh] w-full" />
            )
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
              No hay documento para previsualizar.
            </div>
          )}
        </div>
        <DialogFooter className="px-6 py-3 border-t gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" aria-hidden /> Cerrar
          </Button>
          {onDownload ? (
            <Button onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {downloadLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
