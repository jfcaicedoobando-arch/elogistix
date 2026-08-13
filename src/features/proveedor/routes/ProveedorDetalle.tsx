import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/shared/PageContainer";
import { PackageX } from "lucide-react";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useVolver } from "@/hooks/shared/useVolver";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { toTitleCase } from "@/lib/formatters";
import EditarProveedorDialog from "@/features/proveedor/components/EditarProveedorDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { useProveedorDetalleController } from "@/features/proveedor/hooks";
import { ProveedorBrechaCard } from "../components/ProveedorBrechaCard";
import { ProveedorDetalleHeader } from "../components/ProveedorDetalleHeader";
import { ProveedorDatosBancariosCard } from "../components/ProveedorDatosBancariosCard";
import { ProveedorDatosGeneralesCard } from "../components/ProveedorDatosGeneralesCard";
import { ProveedorResumenCards } from "../components/ProveedorResumenCards";
import { ProveedorAnticiposCard } from "@/features/anticipos-proveedor/components/ProveedorAnticiposCard";
import { ProveedorDetalleTabs } from "./_sections/ProveedorDetalleTabs";
import { esNacionalOrigen } from "@/features/proveedor/domain/documentosProveedor";


export default function ProveedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const volver = useVolver("/compras/proveedores");
  const {
    proveedor, isLoading, isDeleting, partidas, brecha, huerfanas,
    totalFacturado, totalPagado, totalPendiente, agregados,
    canEdit, isAdmin, editOpen, setEditOpen,
    deleteOpen, setDeleteOpen, handleUpdate, handleDelete,
    isErrorProveedor, errorProveedor, refetchProveedor,
    isErrorEstadoCuenta, errorEstadoCuenta, refetchEstadoCuenta, isFetchingEstadoCuenta,
  } = useProveedorDetalleController();
  useRegisterBreadcrumbLabel(id, proveedor?.nombre);

  // Mismo estado de carga que el detalle de cliente (PageContainer + skeleton).
  if (isLoading) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  if (!proveedor) {
    // R3FE-05 (Ola 12): un fallo de carga NO es "proveedor no encontrado".
    if (isErrorProveedor) {
      return (
        <PageContainer>
          <ErrorStateInline
            title="No pudimos cargar el proveedor"
            message={errorProveedor instanceof Error
              ? errorProveedor.message
              : "Error desconocido al consultar la información."}
            onRetry={() => void refetchProveedor()}
          />
        </PageContainer>
      );
    }
    return (
      <DetailNotFound
        icon={PackageX}
        title="Proveedor no encontrado"
        description="El proveedor que buscas no existe, fue eliminado o no tienes permiso para verlo."
        backTo="/compras/proveedores"
        backLabel="Volver a Proveedores"
      />
    );
  }

  const nombreFmt = toTitleCase(proveedor.nombre);
  const rfcFmt = (proveedor.rfc || "").toUpperCase();
  // R3P-14: NULL = Nacional (fuente única: esNacionalOrigen).
  const esNacional = esNacionalOrigen(proveedor.origen_proveedor);
  const categoriaLabel = proveedor.categoria === "GastoOperativo"
    ? (proveedor.subtipo_gasto ?? "Gasto de administración")
    : (proveedor.tipo ?? "—");

  return (
    <PageContainer>
      <ProveedorDetalleHeader
        proveedor={proveedor}
        nombreFmt={nombreFmt}
        rfcFmt={rfcFmt}
        esNacional={esNacional}
        categoriaLabel={categoriaLabel}
        volver={volver}
        canEdit={canEdit}
        isAdmin={isAdmin}
        isDeleting={isDeleting}
        onEditar={() => setEditOpen(true)}
        onEliminar={() => setDeleteOpen(true)}
        onUpdate={handleUpdate}
      />

      {isErrorEstadoCuenta ? (
        <ErrorStateInline
          title="No pudimos cargar las operaciones del proveedor"
          message={errorEstadoCuenta instanceof Error
            ? errorEstadoCuenta.message
            : "Error desconocido al consultar la conciliación."}
          onRetry={() => void refetchEstadoCuenta()}
          retrying={isFetchingEstadoCuenta}
        />
      ) : (
        <ProveedorResumenCards
          totalFacturado={totalFacturado}
          totalPagado={totalPagado}
          totalPendiente={totalPendiente}
          moneda="MXN"
          porMoneda={agregados.porMoneda}
          monedasSinTc={agregados.monedasSinTc}
          operacionesCount={partidas.length}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProveedorDatosGeneralesCard
          rfc={proveedor.rfc}
          contacto={proveedor.contacto}
          email={proveedor.email}
          telefono={proveedor.telefono}
          monedaPreferida={proveedor.moneda_preferida}
        />

        <ProveedorDatosBancariosCard
          banco={proveedor.banco}
          clabe={proveedor.clabe}
          origen={proveedor.origen_proveedor}
          bancoPais={proveedor.banco_pais}
          swiftBic={proveedor.swift_bic}
          iban={proveedor.iban}
          abaRouting={proveedor.aba_routing}
          bancoDireccion={proveedor.banco_direccion}
          bancoIntermediario={proveedor.banco_intermediario}
          bancoIntermediarioSwift={proveedor.banco_intermediario_swift}
          beneficiario={proveedor.beneficiario}
          referenciaPago={proveedor.referencia_pago}
          onCapturar={canEdit ? () => setEditOpen(true) : undefined}
        />
      </div>

      <ProveedorAnticiposCard
        proveedorId={proveedor.id}
        proveedorNombre={proveedor.nombre}
        canEdit={canEdit}
      />

      {!isErrorEstadoCuenta && (
        <ProveedorBrechaCard brecha={brecha} huerfanas={huerfanas} proveedorNombre={nombreFmt} />
      )}

      <ProveedorDetalleTabs
        proveedorId={proveedor.id}
        organizationId={proveedor.organization_id ?? ""}
        nombreFmt={nombreFmt}
        rfc={proveedor.rfc}
        esNacional={esNacional}
        canEdit={canEdit}
        partidas={partidas}
        partidasPendientes={brecha.partidasPendientes}
        isErrorEstadoCuenta={isErrorEstadoCuenta}
        errorEstadoCuenta={errorEstadoCuenta}
        refetchEstadoCuenta={refetchEstadoCuenta}
        isFetchingEstadoCuenta={isFetchingEstadoCuenta}
      />

      <EditarProveedorDialog
        proveedor={proveedor}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleUpdate}
      />

      <DoubleConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName="proveedor"
        description={`Estás a punto de eliminar a ${nombreFmt}. Esta acción no se puede deshacer.`}
        finalDescription={`¿Realmente deseas eliminar permanentemente a ${nombreFmt}?`}
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </PageContainer>
  );
}
