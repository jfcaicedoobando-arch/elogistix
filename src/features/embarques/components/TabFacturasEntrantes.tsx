/**
 * Buzón de facturas de proveedor del embarque.
 *
 * Operación entrega los PDFs/XML que recibe por correo del agente; contabilidad
 * los captura después como factura de proveedor (segregación de funciones).
 *
 * v13.360.0 — Un documento agrupa PDF + XML del mismo CFDI.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntrantesCardHeader } from "@/features/embarques/components/entrantes/EntrantesCardHeader";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Inbox } from "lucide-react";
import { EntrantesConfirmDialogs } from "@/features/embarques/components/entrantes/EntrantesConfirmDialogs";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { notifyError } from "@/lib/ui/appFeedback";
import { extraerCfdiXmlMetaDeArchivo } from "@/lib/domain/cfdiXmlMeta";
import {
  chipsArchivosEntrante,
  faltaXmlFiscal,
  puedeEliminarEntrante,
  puedeReactivarEntrante,
  resumirEntrantes,
} from "@/lib/domain/facturasEntrantes";
import {
  useAdjuntarXmlFacturaEntrante,
  useEliminarFacturaEntrante,
  useFacturasEntrantes,
  useReactivarFacturaEntrante,
} from "@/features/cxp/hooks";

import { abrirFacturaEntrante, type FacturaEntranteRow } from "@/features/cxp/services";
import { SubirFacturaEntranteDialog } from "@/features/embarques/components/SubirFacturaEntranteDialog";
import { CorregirDatosEntranteDialog } from "@/features/embarques/components/entrantes/CorregirDatosEntranteDialog";
import { FacturaEntranteItem } from "@/features/embarques/components/entrantes/FacturaEntranteItem";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";

interface Props {
  embarqueId: string;
  canEdit: boolean;
}

export function TabFacturasEntrantes({ embarqueId, canEdit }: Props) {
  const { organizationId } = useOrgFilter();
  const { user } = useAuth();
  const { isAdmin, canSubirFacturaEntranteEmbarque, canAdjuntarXmlFacturaEntrante } = usePermissions();
  const { data, isLoading } = useFacturasEntrantes(embarqueId);
  // v13.347.0 — deep-link desde el checklist de cierre (?tab=costos&focus=facturas-entrantes).
  const { registerRef } = useFocusSection();
  const eliminar = useEliminarFacturaEntrante();
  const reactivar = useReactivarFacturaEntrante();
  const adjuntarXml = useAdjuntarXmlFacturaEntrante();
  const [subirOpen, setSubirOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<FacturaEntranteRow | null>(null);
  const [aReactivar, setAReactivar] = useState<FacturaEntranteRow | null>(null);
  // v13.508.0 — Corrección de datos declarados sin volver a subir el archivo.
  const [aCorregir, setACorregir] = useState<FacturaEntranteRow | null>(null);


  const filas = data ?? [];
  const resumen = resumirEntrantes(filas);
  const sinXml = filas.filter((row) => faltaXmlFiscal({
    esNacional: (row.proveedores?.origen_proveedor ?? "Nacional") === "Nacional",
    tieneXml: chipsArchivosEntrante(row).includes("xml"),
  })).length;
  // v13.489.0 — Segregación de funciones: operaciones entrega los archivos del
  // agente; contabilidad sólo los consulta y captura la factura desde CxP.
  const puedeSubir = canEdit && canSubirFacturaEntranteEmbarque && Boolean(organizationId);
  // RNF-08 (Ola 11): la RPC `adjuntar_xml_factura_entrante` admite operaciones
  // y contabilidad (matriz ADJUNTAR_XML_FACTURA_ENTRANTE); la UI ofrece el
  // botón exactamente a esos roles — nunca una acción que la base rechaza.
  const puedeAdjuntar = canAdjuntarXmlFacturaEntrante && Boolean(organizationId);

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
        <EntrantesCardHeader
          resumen={resumen}
          sinXml={sinXml}
          puedeSubir={puedeSubir}
          canEdit={canEdit}
          onSubir={() => setSubirOpen(true)}
        />
        <CardContent className="space-y-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {!isLoading && filas.length === 0 && (
            <EmptyStateInline
              icon={Inbox}
              message="Aún no hay facturas de proveedor en el buzón de este embarque."
              className="py-6"
            />
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
              puedeAdjuntarXml={Boolean(puedeAdjuntar && row.estado === "por_capturar")}
              puedeReactivar={canEdit && puedeReactivarEntrante({
                estado: row.estado,
                proveedorFacturaId: row.proveedor_factura_id,
              })}
              onVer={(path, nombre) => void abrirArchivo(path, nombre)}
              onAdjuntarXml={(fila, xml) => void onAdjuntarXml(fila, xml)}
              puedeCorregir={puedeSubir && row.estado !== "capturada"}
              onEliminar={setAEliminar}
              onReactivar={setAReactivar}
              onCorregir={setACorregir}
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

      <CorregirDatosEntranteDialog
        row={aCorregir}
        onOpenChange={(v) => { if (!v) setACorregir(null); }}
      />

      <EntrantesConfirmDialogs
        aEliminar={aEliminar}
        aReactivar={aReactivar}
        onCerrarEliminar={() => setAEliminar(null)}
        onCerrarReactivar={() => setAReactivar(null)}
        onConfirmarEliminar={async () => {
          if (!aEliminar) return;
          await eliminar.mutateAsync({
            id: aEliminar.id,
            archivo_path: aEliminar.archivo_path,
            xml_path: aEliminar.xml_path,
            // RFE-10: requerido para la limpieza segura de storage.
            organization_id: aEliminar.organization_id,
          });
          setAEliminar(null);
        }}
        onConfirmarReactivar={async () => {
          if (!aReactivar) return;
          await reactivar.mutateAsync({ id: aReactivar.id, nombre: aReactivar.nombre_archivo });
          setAReactivar(null);
        }}
      />
    </>
  );

}
