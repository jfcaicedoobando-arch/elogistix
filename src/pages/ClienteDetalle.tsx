import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Building2, Loader2, Ship, FileText, Users, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCliente, useContactosCliente, useCreateContacto, useUpdateContacto, useDeleteContacto, useUpdateCliente, useEmbarquesCliente, useCotizacionesCliente } from "@/hooks/useClientes";
import { useClienteFinancials } from "@/hooks/useClienteFinancials";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { getErrorMessage } from "@/lib/errorUtils";
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import { DataTable } from "@/components/DataTable";
import { embarqueColumns, cotizacionColumns } from "@/components/cliente/clienteColumns";
import type { Tables, Enums } from "@/integrations/supabase/types";
type ContactoCliente = Tables<'contactos_cliente'>;
type TipoContacto = Enums<'tipo_contacto'>;
import DialogContacto from "@/components/cliente/DialogContacto";
import DialogEditarCliente from "@/components/cliente/DialogEditarCliente";
import TablaContactos from "@/components/cliente/TablaContactos";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: cliente, isLoading: loadingCliente } = useCliente(id);
  const { data: contactos = [], isLoading: loadingContactos } = useContactosCliente(id);
  const { data: embarquesCliente = [], isLoading: loadingEmbarques } = useEmbarquesCliente(id);
  const { data: cotizacionesCliente = [], isLoading: loadingCotizaciones } = useCotizacionesCliente(id);
  const { data: financials } = useClienteFinancials(id);
  const createContacto = useCreateContacto();
  const updateContacto = useUpdateContacto();
  const deleteContacto = useDeleteContacto();
  const updateCliente = useUpdateCliente();
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoCliente | null>(null);
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContactoId, setDeletingContactoId] = useState<string | null>(null);

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

  const handleSaveContacto = async (data: { nombre: string; rfc: string; tipo: TipoContacto; pais: string; ciudad: string; direccion: string; contacto: string; email: string; telefono: string }, editingId: string | null) => {
    try {
      if (editingId) {
        await updateContacto.mutateAsync({ id: editingId, cliente_id: cliente.id, ...data });
        toast({ title: "Contacto actualizado" });
      } else {
        await createContacto.mutateAsync({ cliente_id: cliente.id, ...data });
        toast({ title: "Contacto creado" });
      }
      setContactDialogOpen(false);
      setEditingContacto(null);
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleSaveCliente = async (data: { nombre: string; rfc: string; direccion: string; ciudad: string; estado: string; cp: string; contacto: string; email: string; telefono: string }) => {
    try {
      await updateCliente.mutateAsync({ id: cliente.id, ...data });
      registrarActividad.mutate({
        accion: 'editar', modulo: 'clientes',
        entidad_id: cliente.id, entidad_nombre: data.nombre,
      });
      toast({ title: "Cliente actualizado" });
      setEditClienteOpen(false);
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const startDelete = (contactoId: string) => { setDeletingContactoId(contactoId); setDeleteDialogOpen(true); };
  const confirmDelete = async () => {
    if (!deletingContactoId) return;
    try {
      await deleteContacto.mutateAsync({ id: deletingContactoId, cliente_id: cliente.id });
      toast({ title: "Contacto eliminado" });
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  };


  type EmbarqueCliente = (typeof embarquesCliente)[number];
  const embarqueColumns: DataTableColumn<EmbarqueCliente>[] = [
    { key: "expediente", header: "Expediente", width: "w-[110px]", className: "font-medium", render: (e) => e.expediente },
    { key: "modo", header: "Modo", width: "w-[90px]", className: "text-xs", render: (e) => e.modo },
    { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs", render: (e) => `${shortName(e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen)} → ${shortName(e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino)}` },
    { key: "estado", header: "Estado", width: "w-[100px]", render: (e) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(e.estado)}`}>{e.estado}</Badge> },
    { key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs", render: (e) => formatDate(e.etd || "") },
    { key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs", render: (e) => formatDate(e.eta || "") },
  ];

  type CotizacionCliente = (typeof cotizacionesCliente)[number];
  const cotizacionColumns: DataTableColumn<CotizacionCliente>[] = [
    { key: "folio", header: "Folio", width: "w-[100px]", className: "font-medium", render: (c) => c.folio },
    { key: "modo", header: "Modo", width: "w-[80px]", className: "text-xs", render: (c) => c.modo },
    { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs", render: (c) => `${c.origen || "-"} → ${c.destino || "-"}` },
    { key: "subtotal", header: "Subtotal", width: "w-[110px]", className: "text-right text-xs", headerClassName: "text-right", render: (c) => formatCurrency(c.subtotal, c.moneda) },
    { key: "estado", header: "Estado", width: "w-[100px]", render: (c) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(c.estado)}`}>{c.estado}</Badge> },
    { key: "fecha", header: "Fecha", width: "w-[100px]", className: "text-xs", render: (c) => formatDate(c.created_at) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-3 bg-blue-50 text-blue-600">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Embarques</p>
              <p className="text-xl font-bold">{embarquesCliente.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-3 bg-violet-50 text-violet-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cotizaciones</p>
              <p className="text-xl font-bold">{cotizacionesCliente.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-3 bg-emerald-50 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contactos</p>
              <p className="text-xl font-bold">{contactos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-3 bg-cyan-50 text-cyan-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Facturado</p>
              <p className="text-lg font-bold">{formatCurrency(financials?.facturadoUSD ?? 0, 'USD')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-3 bg-amber-50 text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendiente</p>
              <p className="text-lg font-bold">{formatCurrency(financials?.pendienteUSD ?? 0, 'USD')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl p-3 bg-green-50 text-green-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Profit</p>
              <p className="text-lg font-bold">{formatCurrency(financials?.profitUSD ?? 0, 'USD')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="embarques">Embarques ({embarquesCliente.length})</TabsTrigger>
          <TabsTrigger value="cotizaciones">Cotizaciones ({cotizacionesCliente.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Información General</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>{cliente.direccion}</p>
              <p>{cliente.ciudad}, {cliente.estado} {cliente.cp}</p>
              <div className="pt-2 border-t mt-2 space-y-1">
                <p><span className="text-muted-foreground">Contacto:</span> {cliente.contacto}</p>
                <p><span className="text-muted-foreground">Email:</span> {cliente.email}</p>
                <p><span className="text-muted-foreground">Tel:</span> {cliente.telefono}</p>
              </div>
            </CardContent>
          </Card>

          <TablaContactos
            contactos={contactos}
            isLoading={loadingContactos}
            canEdit={canEdit}
            onAdd={() => { setEditingContacto(null); setContactDialogOpen(true); }}
            onEdit={(c) => { setEditingContacto(c); setContactDialogOpen(true); }}
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
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DialogContacto
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contacto={editingContacto}
        onSave={handleSaveContacto}
        isSaving={createContacto.isPending || updateContacto.isPending}
      />

      <DialogEditarCliente
        open={editClienteOpen}
        onOpenChange={setEditClienteOpen}
        cliente={{ nombre: cliente.nombre, rfc: cliente.rfc, direccion: cliente.direccion, ciudad: cliente.ciudad, estado: cliente.estado, cp: cliente.cp, contacto: cliente.contacto, email: cliente.email, telefono: cliente.telefono }}
        onSave={handleSaveCliente}
        isSaving={updateCliente.isPending}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeletingContactoId(null); }}
        entityName="este contacto"
        description="Estás a punto de eliminar este contacto del cliente. ¿Deseas continuar?"
        finalDescription="Esta acción no se puede deshacer. El contacto será eliminado permanentemente. ¿Confirmas la eliminación?"
        onConfirm={confirmDelete}
        isPending={deleteContacto.isPending}
      />
    </div>
  );
}
