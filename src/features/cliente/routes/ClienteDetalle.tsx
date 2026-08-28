import { useParams } from "react-router-dom";
import ClienteSummaryCards from "@/features/cliente/components/ClienteSummaryCards";
import { ClienteDetalleDialogs } from "@/features/cliente/components/detalle/ClienteDetalleDialogs";
import {
  ClienteDetalleHeader,
  ClienteLoadingState,
  ClienteNotFoundState,
} from "@/features/cliente/components/detalle/ClienteDetalleHeader";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";
import { useClienteDetalleController } from "@/features/cliente/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { formatNombreEntidad } from "@/lib/formatNombreEntidad";
import { PageContainer } from "@/components/shared/PageContainer";
import { ClienteDetalleTabs } from "./_sections/ClienteDetalleTabs";
import { leerFlagAutorizacion } from "@/features/cliente/domain/autorizacionCliente";
/** Contactos secundarios + el contacto principal del perfil (si existe). */
function contarContactos(secundarios: number, principal?: string | null): number {
  return secundarios + (principal && principal.trim() ? 1 : 0);
}

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const {
    navigate,
    cliente,
    loadingCliente,
    errorCliente,
    refetchCliente,
    contactos,
    loadingContactos,
    embarquesCliente,
    loadingEmbarques,
    cotizacionesCliente,
    loadingCotizaciones,
    financials,
    canEdit,
    isContactSaving,
    isClientSaving,
    isContactDeleting,
    contactDialogOpen,
    setContactDialogOpen,
    editingContacto,
    editClienteOpen,
    setEditClienteOpen,
    deleteDialogOpen,
    closeDeleteDialog,
    handleSaveContacto,
    handleSaveCliente,
    startDelete,
    confirmDelete,
    openNewContact,
    openEditContact,
  } = useClienteDetalleController();
  useRegisterBreadcrumbLabel(id, cliente?.nombre ? formatNombreEntidad(cliente.nombre) : undefined);

  if (errorCliente) {
    return (
      <PageContainer>
        <ErrorStateInline message={getErrorMessage(errorCliente)} onRetry={() => refetchCliente()} />
      </PageContainer>
    );
  }
  if (loadingCliente) return <ClienteLoadingState />;
  if (!cliente) return <ClienteNotFoundState />;

  return (
    <PageContainer>
      <ClienteDetalleHeader
        cliente={{
          id: cliente.id,
          nombre: cliente.nombre,
          rfc: cliente.rfc,
          direccion: cliente.direccion,
          ciudad: cliente.ciudad,
          estado: cliente.estado,
          regimen_fiscal: cliente.regimen_fiscal,
          dias_credito: cliente.dias_credito,
          limite_credito_mxn: cliente.limite_credito_mxn,
          requiere_autorizacion_cotizacion: leerFlagAutorizacion(cliente, "requiere_autorizacion_cotizacion"),
          requiere_autorizacion_proforma: leerFlagAutorizacion(cliente, "requiere_autorizacion_proforma"),
        }}
        canEdit={canEdit}
        onBack={() => navigate("/clientes")}
        onEdit={() => setEditClienteOpen(true)}
      />

      <ClienteSummaryCards
        embarques={embarquesCliente.length}
        cotizaciones={cotizacionesCliente.length}
        contactos={contarContactos(contactos.length, cliente.contacto)}
        facturadoMXN={financials?.facturadoMXN ?? 0}
        pendienteMXN={financials?.pendienteMXN ?? 0}
        profitMXN={financials?.profitMXN ?? 0}
        facturasSinTc={financials?.facturasSinTc ?? 0}
        embarquesSinTc={financials?.embarquesSinTc ?? 0}
      />

      <ClienteDetalleTabs
        cliente={cliente}
        contactos={contactos}
        loadingContactos={loadingContactos}
        canEdit={canEdit}
        embarquesCliente={embarquesCliente}
        loadingEmbarques={loadingEmbarques}
        cotizacionesCliente={cotizacionesCliente}
        loadingCotizaciones={loadingCotizaciones}
        openNewContact={openNewContact}
        openEditContact={openEditContact}
        startDelete={startDelete}
      />

      <ClienteDetalleDialogs
        cliente={{
          nombre: cliente.nombre,
          rfc: cliente.rfc,
          direccion: cliente.direccion,
          ciudad: cliente.ciudad,
          estado: cliente.estado,
          cp: cliente.cp,
          contacto: cliente.contacto,
          email: cliente.email,
          telefono: cliente.telefono,
          regimen_fiscal: cliente.regimen_fiscal ?? "",
          uso_cfdi_default: cliente.uso_cfdi_default ?? "",
          dias_credito: cliente.dias_credito ?? null,
          limite_credito_mxn: cliente.limite_credito_mxn ?? null,
          sin_comision: Boolean(cliente.sin_comision),
          requiere_autorizacion_cotizacion: leerFlagAutorizacion(cliente, "requiere_autorizacion_cotizacion"),
          requiere_autorizacion_proforma: leerFlagAutorizacion(cliente, "requiere_autorizacion_proforma"),
        }}
        contactDialogOpen={contactDialogOpen}
        setContactDialogOpen={setContactDialogOpen}
        editingContacto={editingContacto}
        handleSaveContacto={handleSaveContacto}
        isContactSaving={isContactSaving}
        editClienteOpen={editClienteOpen}
        setEditClienteOpen={setEditClienteOpen}
        handleSaveCliente={handleSaveCliente}
        isClientSaving={isClientSaving}
        deleteDialogOpen={deleteDialogOpen}
        closeDeleteDialog={closeDeleteDialog}
        confirmDelete={confirmDelete}
        isContactDeleting={isContactDeleting}
      />
    </PageContainer>
  );
}
