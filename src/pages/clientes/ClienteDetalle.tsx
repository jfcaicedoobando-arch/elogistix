import { ArrowLeft, Pencil, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import TabPortalCliente from "@/components/cliente/TabPortalCliente";
import { DataTable } from "@/components/shared/DataTable";
import { embarqueColumns, cotizacionColumns } from "@/components/cliente/clienteColumns";
import TablaContactos from "@/components/cliente/TablaContactos";
import ClienteSummaryCards from "@/components/cliente/ClienteSummaryCards";
import { ClienteDetalleDialogs } from "@/components/cliente/detalle/ClienteDetalleDialogs";
import { useClienteDetalleController } from "@/hooks/cliente/useClienteDetalleController";
import { toTitleCase, formatPhoneMx, correctSpanishPlace } from "@/lib/formatters";
import { useParams } from "react-router-dom";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const {
    navigate,
    cliente,
    loadingCliente,
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

  if (loadingCliente) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/clientes")}>Volver a Clientes</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")} aria-label="Volver a clientes">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cliente.nombre}</h1>
          <p className="text-sm text-muted-foreground">{cliente.rfc}</p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditClienteOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
        )}
      </div>

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
          <TabsTrigger value="portal">Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>{cliente.direccion}</p>
              <p>{correctSpanishPlace(cliente.ciudad)}, {correctSpanishPlace(cliente.estado)} {cliente.cp}</p>
              <div className="pt-2 border-t mt-2 space-y-1">
                <p><span className="text-muted-foreground">Contacto:</span> {toTitleCase(cliente.contacto)}</p>
                <p><span className="text-muted-foreground">Email:</span> {cliente.email}</p>
                <p><span className="text-muted-foreground">Tel:</span> {formatPhoneMx(cliente.telefono)}</p>
              </div>
            </CardContent>
          </Card>

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
                onRowClick={(e) => navigate(`/embarques/${e.id}`)}
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
                onRowClick={(c) => navigate(`/cotizaciones/${c.id}`)}
                rowKey={(c) => c.id}
                density="compact"
              />
            </CardContent>
          </Card>
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
    </div>
  );
}
