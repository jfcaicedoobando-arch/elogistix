import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailTabSection } from "@/components/shared/DetailTabSection";
import { DetailTabLabel } from "@/components/shared/DetailTabLabel";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { ProveedorOperacionesTable } from "../../components/ProveedorOperacionesTable";
import { ProveedorSaludTab } from "../../components/ProveedorSaludTab";
import { ProveedorEstadoCuentaTab } from "../../components/ProveedorEstadoCuentaTab";
import { ProveedorDocumentosTab } from "../../components/ProveedorDocumentosTab";
import type { PartidaEstadoCuenta } from "@/features/proveedor/domain/estadoCuentaProveedor";

interface Props {
  proveedorId: string;
  organizationId: string;
  nombreFmt: string;
  rfc?: string | null;
  esNacional: boolean;
  canEdit: boolean;
  partidas: PartidaEstadoCuenta[];
  partidasPendientes: number;
  /** R3FE-05: un fallo de `proveedor_estado_cuenta` no debe verse como "0". */
  isErrorEstadoCuenta?: boolean;
  errorEstadoCuenta?: unknown;
  refetchEstadoCuenta?: () => void;
  isFetchingEstadoCuenta?: boolean;
}

/**
 * Pestañas del detalle de proveedor. v13.571.0 — homologadas con el detalle de
 * cliente: mismo envoltorio (`DetailTabSection`) y mismo pill de contador
 * (`DetailTabLabel`) en todas las pestañas, no sólo en "Por facturar".
 */
export function ProveedorDetalleTabs({
  proveedorId, organizationId, nombreFmt, rfc, esNacional, canEdit,
  partidas, partidasPendientes,
  isErrorEstadoCuenta, errorEstadoCuenta, refetchEstadoCuenta, isFetchingEstadoCuenta,
}: Props) {
  const errorOperaciones = (
    <ErrorStateInline
      title="No pudimos cargar las operaciones del proveedor"
      message={errorEstadoCuenta instanceof Error
        ? errorEstadoCuenta.message
        : "Error desconocido al consultar la información."}
      onRetry={() => refetchEstadoCuenta?.()}
      retrying={isFetchingEstadoCuenta}
      className="m-6"
    />
  );
  return (
    <Tabs defaultValue="operaciones">
      <TabsList>
        <TabsTrigger value="operaciones">
          <DetailTabLabel count={partidas.length}>Operaciones</DetailTabLabel>
        </TabsTrigger>
        <TabsTrigger value="por_facturar">
          <DetailTabLabel count={partidasPendientes} tone="warning">Por facturar</DetailTabLabel>
        </TabsTrigger>
        <TabsTrigger value="estado_cuenta">Estado de cuenta</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="salud">Salud</TabsTrigger>
      </TabsList>

      <TabsContent value="operaciones" className="mt-4">
        <DetailTabSection title="Historial de operaciones" count={partidas.length}>
          {isErrorEstadoCuenta ? errorOperaciones : (
            <ProveedorOperacionesTable partidas={partidas} />
          )}
        </DetailTabSection>
      </TabsContent>

      <TabsContent value="por_facturar" className="mt-4">
        <DetailTabSection
          title="Costeado sin factura del proveedor"
          count={partidasPendientes}
        >
          {isErrorEstadoCuenta ? errorOperaciones : (
            <ProveedorOperacionesTable partidas={partidas} filtro="por_facturar" />
          )}
        </DetailTabSection>
      </TabsContent>

      <TabsContent value="estado_cuenta" className="mt-4">
        <ProveedorEstadoCuentaTab
          proveedorId={proveedorId}
          proveedorNombre={nombreFmt}
          rfc={rfc}
        />
      </TabsContent>

      <TabsContent value="documentos" className="mt-4">
        <ProveedorDocumentosTab
          proveedorId={proveedorId}
          organizationId={organizationId}
          esNacional={esNacional}
          canEdit={canEdit}
        />
      </TabsContent>

      <TabsContent value="salud" className="mt-4">
        <ProveedorSaludTab proveedorId={proveedorId} />
      </TabsContent>
    </Tabs>
  );
}
