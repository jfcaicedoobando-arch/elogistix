import { useState } from "react";
import { Download, FileCheck, FileX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const DOC_ESTADO_ICON: Record<string, { icon: typeof FileCheck; color: string }> = {
  Pendiente: { icon: FileX, color: "text-amber-500" },
  Recibido: { icon: FileCheck, color: "text-accent" },
  Validado: { icon: FileCheck, color: "text-green-600" },
};

interface Props {
  documentos: Tables<"documentos_embarque">[];
}

export function PortalEmbarqueDocumentos({ documentos }: Props) {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (archivo: string, docId: string) => {
    setDownloadingId(docId);
    try {
      const { data, error } = await supabase.storage
        .from("documentos")
        .createSignedUrl(archivo, 300);
      if (error) throw error;
      const filename = archivo.split("/").pop() || "documento";
      try {
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(data.signedUrl, "_blank");
      }
    } catch {
      toast({ title: "Error al descargar", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        {documentos.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No hay documentos disponibles.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.map((doc) => {
                const docInfo = DOC_ESTADO_ICON[doc.estado] || DOC_ESTADO_ICON.Pendiente;
                const DocIcon = docInfo.icon;
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DocIcon className={`h-4 w-4 ${docInfo.color}`} />
                        <span className="font-medium">{doc.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{doc.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {doc.archivo ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={downloadingId === doc.id}
                          onClick={() => handleDownload(doc.archivo!, doc.id)}
                        >
                          {downloadingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
