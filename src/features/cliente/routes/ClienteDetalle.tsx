"use memo";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import TabPortalCliente from "@/features/cliente/components/TabPortalCliente";
import Cliente360Panel from "@/features/crm/components/Cliente360Panel";
import { DataTable } from "@/components/shared/DataTable";
import { embarqueColumns, cotizacionColumns } from "@/features/cliente/components/clienteColumns";
import TablaContactos from "@/features/cliente/components/TablaContactos";
import ClienteSummaryCards from "@/features/cliente/components/ClienteSummaryCards";
import { ClienteDetalleDialogs } from "@/features/cliente/components/detalle/ClienteDetalleDialogs";
import {
  ClienteDetalleHeader,
  ClienteLoadingState,
  ClienteNotFoundState,
} from "@/features/cliente/components/detalle/ClienteDetalleHeader";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";
import { ClienteInformacionCard } from "@/features/cliente/components/detalle/ClienteInformacionCard";
import { ClienteCreditoCard } from "@/features/cliente/components/detalle/ClienteCreditoCard";
import { useClienteDetalleController } from "@/features/cliente/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { PageContainer } from "@/components/shared/PageContainer";

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
  useRegisterBreadcrumbLabel(id, cliente?.nombre);

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
        }}
        canEdit={canEdit}
        onBack={() => navigate("/clientes")}
        onEdit={() => setEditClienteOpen(true)}
      />

      <ClienteSummaryCards
        embarques={embarquesCliente.length}
        cotizaciones={cotizacionesCliente.length}
        contactos={contactos.length}
        facturadoUSD={financials?.facturadoUSD ?? 0}
        pendienteUSD={financials?.pendienteUSD ?? 0}
        profitUSD={financials?.profitUSD ?? 0}
      />

      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="embarques">Embarques ({embarquesCliente.length})</TabsTrigger>
          <TabsTrigger value="cotizaciones">Cotizaciones ({cotizacionesCliente.length})</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="space-y-6">
          <ClienteInformacionCard
            direccion={cliente.direccion}
            ciudad={cliente.ciudad}
            estado={cliente.estado}
            cp={cliente.cp}
            contacto={cliente.contacto}
            email={cliente.email}
            telefono={cliente.telefono}
          />

          <ClienteCreditoCard clienteId={cliente.id} />

          <TablaContactos
            contactos={contactos}
            isLoading={loadingContactos}
            canEdit={canEdit}
            onAdd={openNewContact}
            onEdit={openEditContact}
            onDelete={startDelete}
          />
        </TabsContent>

        <TabsContent value="embarques">
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={embarqueColumns}
                data={embarquesCliente}
                isLoading={loadingEmbarques}
                emptyMessage="Sin embarques registrados"
                getRowHref={(e) => `/embarques/${e.id}`}
                rowKey={(e) => e.id}
                density="compact"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cotizaciones">
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={cotizacionColumns}
                data={cotizacionesCliente}
                isLoading={loadingCotizaciones}
                emptyMessage="Sin cotizaciones registradas"
                getRowHref={(c) => `/cotizaciones/${c.id}`}
                rowKey={(c) => c.id}
                density="compact"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm">
          <Cliente360Panel clienteId={cliente.id} />
        </TabsContent>

        <TabsContent value="portal">
          <TabPortalCliente clienteId={cliente.id} organizationId={cliente.organization_id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>

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
