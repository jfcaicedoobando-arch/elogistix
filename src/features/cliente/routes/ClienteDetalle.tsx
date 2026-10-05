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
import { useDocumentTitle } from "@/hooks/shared/useDocumentTitle";
/** Contactos secundarios + el contacto principal del perfil (si existe). */
function contarContactos(secundarios: number, principal?: string | null): number {
  return secundarios + (principal && principal.trim() ? 1 : 0);
}


type ClienteRow = NonNullable<ReturnType<typeof useClienteDetalleController>["cliente"]>;

/** Datos fiscales/crédito que consume el header. */
function mapHeader(cliente: ClienteRow) {
  return {
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
  };
}

/** Valores del formulario de edición (sin nulos para los inputs). */
function mapFormulario(cliente: ClienteRow) {
  return {
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
  };
}

/** Sin datos confirmados nunca se muestra deuda cero, tampoco durante un reintento. */
function mapFinancialSummary(
  financials: ReturnType<typeof useClienteDetalleController>["financials"],
) {
  return {
    facturadoMXN: financials?.facturadoMXN ?? null,
    pendienteMXN: financials?.pendienteMXN ?? null,
    profitMXN: financials?.profitMXN ?? null,
    facturasSinTc: financials?.facturasSinTc ?? 0,
    embarquesSinTc: financials?.embarquesSinTc ?? 0,
  };
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
    errorFinancials, refetchFinancials, fetchingFinancials,
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
  useDocumentTitle(!loadingCliente && !errorCliente && cliente?.nombre
    ? `Cliente: ${formatNombreEntidad(cliente.nombre)}` : "Cliente");
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
        cliente={mapHeader(cliente)}
        canEdit={canEdit}
        onBack={() => navigate("/clientes")}
        onEdit={() => setEditClienteOpen(true)}
      />

      {errorFinancials && (
        <ErrorStateInline
          title={financials ? "No pudimos actualizar los datos financieros" : "No pudimos cargar los datos financieros"}
          message={`${financials ? "Se muestran los últimos importes disponibles. " : ""}${getErrorMessage(errorFinancials)}`}
          onRetry={() => void refetchFinancials()}
          retrying={fetchingFinancials}
        />
      )}
      <ClienteSummaryCards
        embarques={embarquesCliente.length}
        cotizaciones={cotizacionesCliente.length}
        contactos={contarContactos(contactos.length, cliente.contacto)}
        {...mapFinancialSummary(financials)}
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
        cliente={mapFormulario(cliente)}
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
