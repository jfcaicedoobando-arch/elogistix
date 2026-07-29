import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabPortalCliente from "@/features/cliente/components/TabPortalCliente";
import Cliente360Panel from "@/features/crm/components/Cliente360Panel";
import { DataTable } from "@/components/shared/DataTable";
import { embarqueColumns, cotizacionColumns } from "@/features/cliente/components/clienteColumns";
import TablaContactos from "@/features/cliente/components/TablaContactos";
import { ClienteInformacionCard } from "@/features/cliente/components/detalle/ClienteInformacionCard";
import { ClienteCreditoCard } from "@/features/cliente/components/detalle/ClienteCreditoCard";
import type { Cliente, ContactoCliente } from "@/features/cliente/types/cliente";

interface Props {
  cliente: Cliente;
  contactos: ContactoCliente[];
  loadingContactos: boolean;
  canEdit: boolean;
  embarquesCliente: { id: string }[];
  loadingEmbarques: boolean;
  cotizacionesCliente: { id: string }[];
  loadingCotizaciones: boolean;
  openNewContact: () => void;
  openEditContact: (c: ContactoCliente) => void;
  startDelete: (c: ContactoCliente) => void;
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
  );
}
