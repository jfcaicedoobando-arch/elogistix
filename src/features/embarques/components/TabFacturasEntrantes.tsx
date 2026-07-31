/**
 * Buzón de facturas de proveedor del embarque.
 *
 * Operación entrega los PDFs/XML que recibe por correo del agente; contabilidad
 * los captura después como factura de proveedor (segregación de funciones).
 *
 * v13.360.0 — Un documento agrupa PDF + XML del mismo CFDI.
 */
import { useState } from "react";
import { Inbox, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { notifyError } from "@/lib/ui/appFeedback";
import { extraerCfdiXmlMetaDeArchivo } from "@/lib/domain/cfdiXmlMeta";
import {
  chipsArchivosEntrante,
  faltaXmlFiscal,
  puedeEliminarEntrante,
  resumirEntrantes,
} from "@/lib/domain/facturasEntrantes";
import {
  useAdjuntarXmlFacturaEntrante,
  useEliminarFacturaEntrante,
  useFacturasEntrantes,
} from "@/features/cxp/hooks/useFacturasEntrantes";
import { abrirFacturaEntrante, type FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";
import { SubirFacturaEntranteDialog } from "@/features/embarques/components/SubirFacturaEntranteDialog";
import { FacturaEntranteItem } from "@/features/embarques/components/entrantes/FacturaEntranteItem";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

export function TabFacturasEntrantes({ embarqueId, canEdit }: Props) {
  const { organizationId } = useOrgFilter();
  const { user } = useAuth();
  const { isAdmin, canEditOperations, canCapturarFacturaProveedor } = usePermissions();
  const { data, isLoading } = useFacturasEntrantes(embarqueId);
  // v13.347.0 — deep-link desde el checklist de cierre (?tab=costos&focus=facturas-entrantes).
  const { registerRef } = useFocusSection();
  const eliminar = useEliminarFacturaEntrante();
  const adjuntarXml = useAdjuntarXmlFacturaEntrante();
  const [subirOpen, setSubirOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<FacturaEntranteRow | null>(null);

  const filas = data ?? [];
  const resumen = resumirEntrantes(filas);
  const sinXml = filas.filter((row) => faltaXmlFiscal({
    esNacional: (row.proveedores?.origen_proveedor ?? "Nacional") === "Nacional",
    tieneXml: chipsArchivosEntrante(row).includes("xml"),
  })).length;
  const puedeSubir = canEdit && (canEditOperations || canCapturarFacturaProveedor) && Boolean(organizationId);

  const abrirArchivo = async (path: string, nombre: string) => {
    try {
      await abrirFacturaEntrante(path, nombre);
    } catch (error) {
      notifyError(undefined, { title: "No se pudo abrir el archivo", error, method: "ABRIR_FACTURA_ENTRANTE" });
    }
  };

  const onAdjuntarXml = async (row: FacturaEntranteRow, xml: File) => {
    if (!organizationId) return;
    const meta = await extraerCfdiXmlMetaDeArchivo(xml).catch(() => null);
    await adjuntarXml.mutateAsync({
      id: row.id,
      xml,
      meta,
      embarqueId,
      organizationId,
    });
  };

  return (
    <>
      <Card ref={registerRef("facturas-entrantes")} data-focus="facturas-entrantes">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              Facturas de proveedor recibidas
            </CardTitle>
            <CardDescription>
              Sube el PDF y el XML de la factura en un mismo documento. No creas la factura: contabilidad la captura.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="warning" size="sm">{resumen.porCapturar} por capturar</Badge>
              <Badge variant="success" size="sm">{resumen.capturadas} capturadas</Badge>
              {resumen.rechazadas > 0 && (
                <Badge variant="destructive" size="sm">{resumen.rechazadas} rechazadas</Badge>
              )}
              {sinXml > 0 && <Badge variant="warning" size="sm">{sinXml} sin XML</Badge>}
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
            <FacturaEntranteItem
              key={row.id}
              row={row}
              puedeEliminar={canEdit && puedeEliminarEntrante({
                estado: row.estado,
                subidoPor: row.subido_por,
                userId: user?.id ?? null,
                isAdmin,
              })}
              puedeAdjuntarXml={Boolean(puedeSubir && row.estado === "por_capturar")}
              onVer={(path, nombre) => void abrirArchivo(path, nombre)}
              onAdjuntarXml={(fila, xml) => void onAdjuntarXml(fila, xml)}
              onEliminar={setAEliminar}
            />
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
          await eliminar.mutateAsync({
            id: aEliminar.id,
            archivo_path: aEliminar.archivo_path,
            xml_path: aEliminar.xml_path,
          });
          setAEliminar(null);
        }}
      />
    </>
  );
}
