/**
 * Ola 3 — Pestaña "Documentos" del detalle de proveedor: expediente fiscal y
 * legal (CSF, opinión de cumplimiento, comprobante bancario, contratos) con
 * control de vigencia, descarga con liga firmada y borrado lógico.
 */
import { useMemo, useState } from "react";
import { FilePlus2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import EmptyState from "@/components/empty/EmptyState";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import {
  calcularExpediente,
  type DocumentoProveedor,
  type TipoDocumentoProveedor,
} from "@/features/proveedor/domain/documentosProveedor";
import {
  useProveedorDocumentos,
  useEliminarDocumentoProveedor,
} from "@/features/proveedor/hooks/useProveedorDocumentos";
import { urlDocumentoProveedor } from "@/features/proveedor/services/proveedorDocumentos";
import { ProveedorExpedienteCard } from "./ProveedorExpedienteCard";
import { SubirDocumentoProveedorDialog } from "./SubirDocumentoProveedorDialog";
import { documentosProveedorColumns } from "./proveedorDocumentosColumns";

interface Props {
  proveedorId: string;
  organizationId: string;
  esNacional: boolean;
  canEdit: boolean;
}

export function ProveedorDocumentosTab({
  proveedorId, organizationId, esNacional, canEdit,
}: Props) {
  const { data, isLoading } = useProveedorDocumentos(proveedorId);
  const eliminar = useEliminarDocumentoProveedor(proveedorId);
  const [subirOpen, setSubirOpen] = useState(false);
  const [tipoSugerido, setTipoSugerido] = useState<TipoDocumentoProveedor | undefined>();
  const [porBorrar, setPorBorrar] = useState<DocumentoProveedor | null>(null);

  const documentos = data ?? [];
  const resumen = useMemo(
    () => calcularExpediente(documentos, esNacional),
    [documentos, esNacional],
  );

  const abrirSubida = (tipo?: TipoDocumentoProveedor) => {
    setTipoSugerido(tipo);
    setSubirOpen(true);
  };

  const descargar = async (doc: DocumentoProveedor) => {
    try {
      const url = await urlDocumentoProveedor(doc.archivo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo generar la liga de descarga del documento");
    }
  };

  const cols: ColumnDef<DocumentoProveedor, unknown>[] = defineColumns<DocumentoProveedor>(
    documentosProveedorColumns<DocumentoProveedor>({
      onDescargar: (d) => void descargar(d),
      onEliminar: canEdit ? (d) => setPorBorrar(d) : undefined,
    }),
  );

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="space-y-4">
      <ProveedorExpedienteCard
        resumen={resumen}
        onAgregar={canEdit ? abrirSubida : undefined}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>
            Documentos
            <span className="ml-2 font-normal text-muted-foreground tabular-nums">
              {documentos.length}
            </span>
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => abrirSubida()}>
              <FilePlus2 className="mr-2 h-4 w-4" /> Agregar documento
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <DataTable
            columns={cols}
            data={documentos}
            rowKey={(d) => d.id}
            density={TABLE_DENSITY.embebida}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={FolderOpen}
                  title="Sin documentos en el expediente"
                  description="Sube la constancia de situación fiscal, la opinión de cumplimiento y el comprobante de datos bancarios para dejar el expediente completo."
                />
              </div>
            }
          />
        </CardContent>
      </Card>

      {canEdit && (
        <SubirDocumentoProveedorDialog
          open={subirOpen}
          onOpenChange={setSubirOpen}
          proveedorId={proveedorId}
          organizationId={organizationId}
          tipoSugerido={tipoSugerido}
        />
      )}

      <DoubleConfirmDeleteDialog
        open={porBorrar !== null}
        onOpenChange={(v) => { if (!v) setPorBorrar(null); }}
        entityName={porBorrar?.nombre ?? ""}
        description="Se quitará este documento del expediente del proveedor y se borrará el archivo del almacenamiento."
        isPending={eliminar.isPending}
        onConfirm={() => {
          if (!porBorrar) return;
          eliminar.mutate(
            { id: porBorrar.id, archivo: porBorrar.archivo },
            { onSuccess: () => setPorBorrar(null) },
          );
        }}
      />
    </div>
  );
}
