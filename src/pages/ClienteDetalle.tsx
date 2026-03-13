import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCliente, useContactosCliente, useCreateContacto, useUpdateContacto, useDeleteContacto, useUpdateCliente } from "@/hooks/useClientes";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import type { ContactoCliente } from "@/data/types";
import DialogContacto from "@/components/cliente/DialogContacto";
import DialogEditarCliente from "@/components/cliente/DialogEditarCliente";
import TablaContactos from "@/components/cliente/TablaContactos";
import DeleteContactoDialogs from "@/components/cliente/DeleteContactoDialogs";

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: cliente, isLoading: loadingCliente } = useCliente(id);
  const { data: contactos = [], isLoading: loadingContactos } = useContactosCliente(id);
  const createContacto = useCreateContacto();
  const updateContacto = useUpdateContacto();
  const deleteContacto = useDeleteContacto();
  const updateCliente = useUpdateCliente();
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  // Contact dialog
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContacto, setEditingContacto] = useState<ContactoCliente | null>(null);

  // Edit client dialog
  const [editClienteOpen, setEditClienteOpen] = useState(false);

  // Delete contact
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
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

  const handleSaveContacto = async (data: any, editingId: string | null) => {
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
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const startDelete = (contactoId: string) => { setDeletingContactoId(contactoId); setDeleteStep(1); };
  const cancelDelete = () => { setDeleteStep(0); setDeletingContactoId(null); };
  const confirmFinalDelete = async () => {
    if (!deletingContactoId) return;
    try {
      await deleteContacto.mutateAsync({ id: deletingContactoId, cliente_id: cliente.id });
      toast({ title: "Contacto eliminado" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      cancelDelete();
    }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Contactos Registrados</p>
            <p className="text-xl font-bold">{contactos.length}</p>
          </CardContent>
        </Card>
      </div>

      <TablaContactos
        contactos={contactos}
        isLoading={loadingContactos}
        canEdit={canEdit}
        onAdd={() => { setEditingContacto(null); setContactDialogOpen(true); }}
        onEdit={(c) => { setEditingContacto(c); setContactDialogOpen(true); }}
        onDelete={startDelete}
      />

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

      <DeleteContactoDialogs
        step={deleteStep}
        onConfirmFirst={() => setDeleteStep(2)}
        onConfirmFinal={confirmFinalDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
