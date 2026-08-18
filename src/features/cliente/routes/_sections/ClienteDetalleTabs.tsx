import { DetailTabLabel } from "@/components/shared/DetailTabLabel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabPortalCliente from "@/features/cliente/components/TabPortalCliente";
import Cliente360Panel from "@/features/crm/components/Cliente360Panel";
import { EstadoCuentaModule } from "@/features/facturacion/estadoCuenta/components/EstadoCuentaModule";
import TablaContactos from "@/features/cliente/components/TablaContactos";
import { ClienteDocumentosTab } from "@/features/cliente/components/ClienteDocumentosTab";
import { ClienteInformacionCard } from "@/features/cliente/components/detalle/ClienteInformacionCard";
import { ClienteCreditoCard } from "@/features/cliente/components/detalle/ClienteCreditoCard";
import { ClienteDetalleTablasTabs } from "@/features/cliente/routes/_sections/ClienteDetalleTablasTabs";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useTabsParam } from "@/hooks/shared/useTabsParam";
import type { EmbarqueCliente, CotizacionCliente } from "@/features/cliente/components/clienteColumns";
import type { ContactoCliente } from "@/features/cliente/types/cliente";


/** Pestañas válidas del detalle de cliente (UX-04: persistidas en ?tab=). */
const CLIENTE_TABS = [
  "informacion", "embarques", "cotizaciones", "estado_cuenta",
  "documentos", "crm", "portal",
] as const;

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
  /** Con crédito exigimos además la solicitud de crédito en el expediente. */
  dias_credito?: number | null;
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
  const { canEditExpediente } = usePermissions();
  // UX-04: la pestaña vive en la URL (?tab=) para que sobreviva a recargas y deep-links.
  const { activeTab, setActiveTab } = useTabsParam(CLIENTE_TABS, "informacion");
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="informacion">Información</TabsTrigger>
        <TabsTrigger value="embarques">
          <DetailTabLabel count={embarquesCliente.length}>Embarques</DetailTabLabel>
        </TabsTrigger>
        <TabsTrigger value="cotizaciones">
          <DetailTabLabel count={cotizacionesCliente.length}>Cotizaciones</DetailTabLabel>
        </TabsTrigger>
        <TabsTrigger value="estado_cuenta">Estado de cuenta</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
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

      <ClienteDetalleTablasTabs
        canEdit={canEdit}
        embarquesCliente={embarquesCliente}
        loadingEmbarques={loadingEmbarques}
        cotizacionesCliente={cotizacionesCliente}
        loadingCotizaciones={loadingCotizaciones}
      />


      {/* Homologación con proveedor: el estado de cuenta vive dentro de la ficha,
          además de conservar su ruta dedicada para impresión/compartir. */}
      <TabsContent value="estado_cuenta" className="mt-4">
        <EstadoCuentaModule clienteIds={[cliente.id]} facturaHrefBase="/facturacion" />
      </TabsContent>

      {/* Ola 4 — expediente documental del cliente, espejo del de proveedor. */}
      <TabsContent value="documentos" className="mt-4">
        <ClienteDocumentosTab
          clienteId={cliente.id}
          organizationId={cliente.organization_id}
          conCredito={(cliente.dias_credito ?? 0) > 0}
          canEdit={canEditExpediente}
        />
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
