import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClienteTabSection } from "./ClienteTabSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabPortalCliente from "@/features/cliente/components/TabPortalCliente";
import Cliente360Panel from "@/features/crm/components/Cliente360Panel";
import { DataTable } from "@/components/shared/DataTable";
import { embarqueColumns, cotizacionColumns } from "@/features/cliente/components/clienteColumns";
import TablaContactos from "@/features/cliente/components/TablaContactos";
import { ClienteInformacionCard } from "@/features/cliente/components/detalle/ClienteInformacionCard";
import { ClienteCreditoCard } from "@/features/cliente/components/detalle/ClienteCreditoCard";
import type { EmbarqueCliente, CotizacionCliente } from "@/features/cliente/components/clienteColumns";
import type { ContactoCliente } from "@/features/cliente/types/cliente";

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
        <TabsTrigger value="embarques">Embarques ({embarquesCliente.length})</TabsTrigger>
        <TabsTrigger value="cotizaciones">Cotizaciones ({cotizacionesCliente.length})</TabsTrigger>
        <TabsTrigger value="crm">CRM</TabsTrigger>
        <TabsTrigger value="portal">Portal</TabsTrigger>
      </TabsList>

      <TabsContent value="informacion" className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
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

      <TabsContent value="embarques">
        <ClienteTabSection title="Embarques del cliente" count={embarquesCliente.length}>
          <DataTable
            columns={embarqueColumns}
            data={embarquesCliente}
            isLoading={loadingEmbarques}
            emptyMessage="Sin embarques registrados. Los embarques se generan al confirmar una cotización."
            getRowHref={(e) => `/embarques/${e.id}`}
            rowKey={(e) => e.id}
            density="compact"
          />
        </ClienteTabSection>
      </TabsContent>

      <TabsContent value="cotizaciones">
        <ClienteTabSection
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
            emptyMessage="Sin cotizaciones registradas para este cliente."
            getRowHref={(c) => `/cotizaciones/${c.id}`}
            rowKey={(c) => c.id}
            density="compact"
          />
        </ClienteTabSection>
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
