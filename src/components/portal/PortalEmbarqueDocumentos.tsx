import { Download, FileCheck, FileX, Loader2 } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { usePortalDocumentDownload } from "@/hooks/portal";
import type { Tables } from "@/types/db";

type Doc = Tables<"documentos_embarque">;

const DOC_ESTADO_ICON: Record<string, { icon: typeof FileCheck; color: string }> = {
  Pendiente: { icon: FileX, color: "text-amber-500" },
  Recibido: { icon: FileCheck, color: "text-accent" },
  Validado: { icon: FileCheck, color: "text-success" },
};

interface Props {
  documentos: Doc[];
}

export function PortalEmbarqueDocumentos({ documentos }: Props) {
  const { downloadingId, handleDownload } = usePortalDocumentDownload();

  const columns: ColumnDef<Doc, unknown>[] = defineColumns<Doc>([
    {
      id: "doc", header: "Documento",
      cell: ({ row }) => {
        const doc = row.original;
        const info = DOC_ESTADO_ICON[doc.estado] || DOC_ESTADO_ICON.Pendiente;
        const Icon = info.icon;
        return (
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${info.color}`} />
            <span className="font-medium">{doc.nombre}</span>
          </div>
        );
      },
    },
    { id: "estado", header: "Estado", cell: ({ row }) => <Badge variant="secondary" className="text-xs">{row.original.estado}</Badge> },
    {
      id: "accion", header: "Acción",
      meta: { align: "right", width: "w-24" },
      cell: ({ row }) => {
        const doc = row.original;
        return doc.archivo ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={downloadingId === doc.id}
            onClick={(e) => { e.stopPropagation(); handleDownload(doc.archivo!, doc.id); }}
          >
            {downloadingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
  ]);

  return (
    <Card>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={documentos}
          rowKey={(d) => d.id}
          emptyState={<EmptyStateInline icon={FileCheck} message="No hay documentos disponibles." className="py-12" />}
        />
      </CardContent>
    </Card>
  );
}
