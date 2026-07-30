/**
 * Buzón de facturas de proveedor del embarque.
 *
 * Operación entrega los PDFs/XML que recibe por correo del agente; contabilidad
 * los captura después como factura de proveedor (segregación de funciones).
 */
import { useState } from "react";
import { Download, Inbox, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { formatDate } from "@/lib/formatters/dates";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  diasEnEspera,
  etiquetaEstadoEntrante,
  puedeEliminarEntrante,
  resumirEntrantes,
  varianteEstadoEntrante,
} from "@/features/cxp/domain/facturasEntrantes";
import {
  useEliminarFacturaEntrante,
  useFacturasEntrantes,
} from "@/features/cxp/hooks/useFacturasEntrantes";
import { urlFirmadaFacturaEntrante, type FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";
import { SubirFacturaEntranteDialog } from "@/features/cxp/components/SubirFacturaEntranteDialog";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

export function TabFacturasEntrantes({ embarqueId, canEdit }: Props) {
  const { organizationId } = useOrgFilter();
  const { user } = useAuth();
  const { isAdmin, canEditOperations, canCapturarFacturaProveedor } = usePermissions();
  const { data, isLoading } = useFacturasEntrantes(embarqueId);
  const eliminar = useEliminarFacturaEntrante();
  const [subirOpen, setSubirOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<FacturaEntranteRow | null>(null);

  const filas = data ?? [];
  const resumen = resumirEntrantes(filas);
  const puedeSubir = canEdit && (canEditOperations || canCapturarFacturaProveedor) && Boolean(organizationId);

  const abrirArchivo = async (row: FacturaEntranteRow) => {
    try {
      const url = await urlFirmadaFacturaEntrante(row.archivo_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notifyError(undefined, { title: "No se pudo abrir el archivo", error, method: "ABRIR_FACTURA_ENTRANTE" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              Facturas de proveedor recibidas
            </CardTitle>
            <CardDescription>
              Sube aquí los invoices que te envían los agentes. No creas la factura: contabilidad la captura.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="warning" size="sm">{resumen.porCapturar} por capturar</Badge>
              <Badge variant="success" size="sm">{resumen.capturadas} capturadas</Badge>
              {resumen.rechazadas > 0 && (
                <Badge variant="destructive" size="sm">{resumen.rechazadas} rechazadas</Badge>
              )}
            </div>
          </div>
          {puedeSubir && (
            <Button size="sm" onClick={() => setSubirOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Subir factura
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && filas.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay facturas de proveedor en el buzón de este embarque.
            </p>
          )}
          {filas.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{row.nombre_archivo}</span>
                  <Badge variant={varianteEstadoEntrante(row.estado)} size="sm">
                    {etiquetaEstadoEntrante(row.estado)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Subida el {formatDate(row.created_at)}
                  {row.estado === "por_capturar" && ` · ${diasEnEspera(row.created_at)} día(s) en espera`}
                  {row.proveedores?.nombre ? ` · ${row.proveedores.nombre}` : ""}
                </p>
                {row.nota && <p className="text-xs text-muted-foreground">Nota: {row.nota}</p>}
                {row.rechazo_motivo && (
                  <p className="text-xs text-destructive">Rechazada: {row.rechazo_motivo}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => void abrirArchivo(row)}>
                  <Download className="mr-2 h-4 w-4" /> Ver
                </Button>
                {puedeEliminarEntrante({
                  estado: row.estado,
                  subidoPor: row.subido_por,
                  userId: user?.id ?? null,
                  isAdmin,
                }) && canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => setAEliminar(row)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {organizationId && (
        <SubirFacturaEntranteDialog
          open={subirOpen}
          onOpenChange={setSubirOpen}
          embarqueId={embarqueId}
          organizationId={organizationId}
        />
      )}

      <ConfirmActionDialog
        open={Boolean(aEliminar)}
        onOpenChange={(v) => { if (!v) setAEliminar(null); }}
        title="Retirar archivo del buzón"
        description="El archivo dejará de estar disponible para contabilidad. Esta acción no se puede deshacer."
        confirmLabel="Retirar"
        variant="destructive"
        onConfirm={async () => {
          if (!aEliminar) return;
          await eliminar.mutateAsync({ id: aEliminar.id, archivo_path: aEliminar.archivo_path });
          setAEliminar(null);
        }}
      />
    </>
  );
}
