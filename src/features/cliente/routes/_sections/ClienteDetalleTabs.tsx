import { Link } from "react-router-dom";
import { Plus, Ship, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailTabSection } from "@/components/shared/DetailTabSection";
import { DetailTabLabel } from "@/components/shared/DetailTabLabel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabPortalCliente from "@/features/cliente/components/TabPortalCliente";
import Cliente360Panel from "@/features/crm/components/Cliente360Panel";
import EmptyState from "@/components/empty/EmptyState";
import { DataTable } from "@/components/shared/DataTable";
import { EstadoCuentaModule } from "@/features/facturacion/estadoCuenta/components/EstadoCuentaModule";
import { embarqueColumns, cotizacionColumns } from "@/features/cliente/components/clienteColumns";
import TablaContactos from "@/features/cliente/components/TablaContactos";
import { ClienteInformacionCard } from "@/features/cliente/components/detalle/ClienteInformacionCard";
import { ClienteCreditoCard } from "@/features/cliente/components/detalle/ClienteCreditoCard";
import type { EmbarqueCliente, CotizacionCliente } from "@/features/cliente/components/clienteColumns";
import type { ContactoCliente } from "@/features/cliente/types/cliente";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

/** Sólo los campos del cliente que consumen las pestañas (evita acoplarse a la fila completa). */
interface ClienteTabsData {
  id: string;
  organization_id: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
}

interface Props {
  cliente: ClienteTabsData;
  contactos: ContactoCliente[];
  loadingContactos: boolean;
  canEdit: boolean;
  embarquesCliente: EmbarqueCliente[];
  loadingEmbarques: boolean;
  cotizacionesCliente: CotizacionCliente[];
  loadingCotizaciones: boolean;
  openNewContact: () => void;
  openEditContact: (c: ContactoCliente) => void;
  startDelete: (contactoId: string) => void;
}


export function ClienteDetalleTabs({
  cliente,
  contactos,
  loadingContactos,
  canEdit,
  embarquesCliente,
  loadingEmbarques,
  cotizacionesCliente,
  loadingCotizaciones,
  openNewContact,
  openEditContact,
  startDelete,
}: Props) {
  return (
    <Tabs defaultValue="informacion">
      <TabsList>
        <TabsTrigger value="informacion">Información</TabsTrigger>
        <TabsTrigger value="embarques">
          <DetailTabLabel count={embarquesCliente.length}>Embarques</DetailTabLabel>
        </TabsTrigger>
        <TabsTrigger value="cotizaciones">
          <DetailTabLabel count={cotizacionesCliente.length}>Cotizaciones</DetailTabLabel>
        </TabsTrigger>
        <TabsTrigger value="estado_cuenta">Estado de cuenta</TabsTrigger>
        <TabsTrigger value="crm">CRM</TabsTrigger>
        <TabsTrigger value="portal">Portal</TabsTrigger>
      </TabsList>

      <TabsContent
        value="informacion"
        className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"
      >
        <div className="space-y-6">
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
        </div>

        <TablaContactos
          contactos={contactos}
          isLoading={loadingContactos}
          canEdit={canEdit}
          onAdd={openNewContact}
          onEdit={openEditContact}
          onDelete={startDelete}
        />
      </TabsContent>

      <TabsContent value="embarques" className="mt-4">
        <DetailTabSection title="Embarques del cliente" count={embarquesCliente.length}>
          <DataTable
            columns={embarqueColumns}
            data={embarquesCliente}
            isLoading={loadingEmbarques}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Ship}
                  title="Sin embarques registrados"
                  description="Los embarques se generan al confirmar una cotización de este cliente."
                />
              </div>
            }
            getRowHref={(e) => `/embarques/${e.id}`}
            rowKey={(e) => e.id}
            density={TABLE_DENSITY.embebida}
          />
        </DetailTabSection>
      </TabsContent>

      <TabsContent value="cotizaciones" className="mt-4">
        <DetailTabSection
          title="Cotizaciones del cliente"
          count={cotizacionesCliente.length}
          actions={
            canEdit ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/cotizaciones/nueva">
                  <Plus className="h-4 w-4 mr-1" /> Nueva cotización
                </Link>
              </Button>
            ) : undefined
          }
        >
          <DataTable
            columns={cotizacionColumns}
            data={cotizacionesCliente}
            isLoading={loadingCotizaciones}
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={ClipboardList}
                  title="Sin cotizaciones registradas"
                  description="Cotiza una ruta para este cliente y aparecerá aquí."
                />
              </div>
            }
            getRowHref={(c) => `/cotizaciones/${c.id}`}
            rowKey={(c) => c.id}
            density={TABLE_DENSITY.embebida}
          />
        </DetailTabSection>
      </TabsContent>

      {/* Homologación con proveedor: el estado de cuenta vive dentro de la ficha,
          además de conservar su ruta dedicada para impresión/compartir. */}
      <TabsContent value="estado_cuenta" className="mt-4">
        <EstadoCuentaModule clienteIds={[cliente.id]} facturaHrefBase="/facturacion" />
      </TabsContent>

      <TabsContent value="crm" className="mt-4">
        <Cliente360Panel clienteId={cliente.id} />
      </TabsContent>

      <TabsContent value="portal" className="mt-4">
        <TabPortalCliente clienteId={cliente.id} organizationId={cliente.organization_id} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
