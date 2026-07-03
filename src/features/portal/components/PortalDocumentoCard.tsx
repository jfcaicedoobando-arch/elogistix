/**
 * Card de documento de embarque para vista mobile.
 * Vertical, full-width, con botón de descarga grande para tap-friendly.
 */
import { Download, FileCheck, FileX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/types/db";

type Doc = Tables<"documentos_embarque">;

const DOC_ESTADO_ICON: Record<string, { icon: typeof FileCheck; color: string }> = {
  Pendiente: { icon: FileX, color: "text-warning" },
  Recibido: { icon: FileCheck, color: "text-accent" },
  Validado: { icon: FileCheck, color: "text-success" },
};

interface Props {
  doc: Doc;
  downloadingId: string | null;
  onDownload: (archivo: string, id: string) => void;
}

export function PortalDocumentoCard({ doc, downloadingId, onDownload }: Props) {
  const info = DOC_ESTADO_ICON[doc.estado] || DOC_ESTADO_ICON.Pendiente;
  const Icon = info.icon;
  const downloading = downloadingId === doc.id;

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${info.color}`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm break-words">{doc.nombre}</p>
            <Badge variant="secondary" className="text-2xs mt-1">
              {doc.estado}
            </Badge>
          </div>
        </div>
        {doc.archivo ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={downloading}
            onClick={() => onDownload(doc.archivo!, doc.id)}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Descargar
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-1">
            Sin archivo disponible
          </p>
        )}
      </CardContent>
    </Card>
  );
}
