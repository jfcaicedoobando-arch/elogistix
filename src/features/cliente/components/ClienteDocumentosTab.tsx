/**
 * Ola 4 — Pestaña "Documentos" del detalle de cliente: expediente comercial y
 * fiscal (CSF, comprobante de domicilio, contrato, soporte de crédito) con el
 * mismo semáforo, tabla y modal que el expediente de proveedor.
 */
import { useMemo, useState } from "react";
import { FilePlus2, FolderOpen } from "lucide-react";
import { notifyError } from "@/lib/ui/appFeedback";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { DocumentoClienteMobileCard } from "@/features/cliente/components/DocumentoClienteMobileCard";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import EmptyState from "@/components/empty/EmptyState";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { ExpedienteResumenCard } from "@/features/expediente/components/ExpedienteResumenCard";
import { SubirDocumentoDialog } from "@/features/expediente/components/SubirDocumentoDialog";
import { expedienteColumns } from "@/features/expediente/components/expedienteColumns";
import {
  calcularExpedienteCliente,
  TIPOS_DOCUMENTO_CLIENTE,
  TIPOS_CON_VENCIMIENTO_CLIENTE,
  type DocumentoCliente,
  type TipoDocumentoCliente,
} from "@/features/cliente/domain/documentosCliente";
import {
  useClienteDocumentos,
  useSubirDocumentoCliente,
  useEliminarDocumentoCliente,
} from "@/features/cliente/hooks/useClienteDocumentos";
import { urlDocumentoCliente } from "@/features/cliente/services/clienteDocumentos";

interface Props {
  clienteId: string;
  organizationId: string;
  /** Si el cliente opera con crédito exigimos además la solicitud de crédito. */
  conCredito: boolean;
  canEdit: boolean;
}

export function ClienteDocumentosTab({
  clienteId, organizationId, conCredito, canEdit,
}: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useClienteDocumentos(clienteId);
  const subir = useSubirDocumentoCliente(clienteId);
  const eliminar = useEliminarDocumentoCliente(clienteId);
  const [subirOpen, setSubirOpen] = useState(false);
  const [tipoSugerido, setTipoSugerido] = useState<string | undefined>();
  const [porBorrar, setPorBorrar] = useState<DocumentoCliente | null>(null);

  const documentos = useMemo(() => data ?? [], [data]);
  const resumen = useMemo(
    () => calcularExpedienteCliente(documentos, conCredito),
    [documentos, conCredito],
  );

  const abrirSubida = (tipo?: string) => {
    setTipoSugerido(tipo);
    setSubirOpen(true);
  };

  const descargar = async (doc: DocumentoCliente) => {
    try {
      const url = await urlDocumentoCliente(doc.archivo);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo generar la liga de descarga",
        description: "Vuelve a intentarlo; si persiste, el archivo pudo haberse movido.",
        error: e,
        method: "DOWNLOAD_CLIENTE_DOCUMENTO",
      });
    }
  };

  const cols: ColumnDef<DocumentoCliente, unknown>[] = defineColumns<DocumentoCliente>(
    expedienteColumns<DocumentoCliente>({
      onDescargar: (d) => void descargar(d),
      onEliminar: canEdit ? (d) => setPorBorrar(d) : undefined,
    }),
  );

  if (isLoading) return <CardSkeleton />;

  if (isError) {
    return (
      <ErrorStateInline
        title="No pudimos cargar el expediente del cliente"
        message={error instanceof Error ? error.message : "Error desconocido"}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ExpedienteResumenCard
        titulo="Expediente del cliente"
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
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={cols}
            data={documentos}
            rowKey={(d) => d.id}
            density={TABLE_DENSITY.embebida}
            mobileCard={(d) => (
              <DocumentoClienteMobileCard
                doc={d}
                onDescargar={(doc) => void descargar(doc)}
                onEliminar={canEdit ? (doc) => setPorBorrar(doc) : undefined}
              />
            )}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={FolderOpen}
                  title="Sin documentos en el expediente"
                  description="Sube la constancia de situación fiscal, el comprobante de domicilio y el contrato de servicios para dejar el expediente completo."
                />
              </div>
            }
          />
        </CardContent>
      </Card>

      {canEdit && (
        <SubirDocumentoDialog
          open={subirOpen}
          onOpenChange={setSubirOpen}
          tipos={TIPOS_DOCUMENTO_CLIENTE}
          tiposConVencimiento={TIPOS_CON_VENCIMIENTO_CLIENTE}
          tipoSugerido={tipoSugerido}
          descripcion="Guarda constancias, contratos, comprobantes de domicilio y soporte de crédito del cliente."
          isPending={subir.isPending}
          onGuardar={(v) =>
            subir.mutate(
              {
                clienteId,
                organizationId,
                tipo: v.tipo as TipoDocumentoCliente,
                archivo: v.archivo,
                fechaDocumento: v.fechaDocumento,
                fechaVencimiento: v.fechaVencimiento,
                notas: v.notas,
              },
              { onSuccess: () => setSubirOpen(false) },
            )
          }
        />
      )}

      <DoubleConfirmDeleteDialog
        open={porBorrar !== null}
        onOpenChange={(v) => { if (!v) setPorBorrar(null); }}
        entityName={porBorrar?.nombre ?? ""}
        description="Se quitará este documento del expediente del cliente y se borrará el archivo del almacenamiento."
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
