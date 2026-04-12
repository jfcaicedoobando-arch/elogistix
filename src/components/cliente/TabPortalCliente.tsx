import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Trash2, Globe, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { formatDate } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { useInviteClientUser, useRevokeClientUser } from "@/hooks/useClientUsersMutations";

interface Props {
  clienteId: string;
  organizationId: string;
  canEdit: boolean;
}

export default function TabPortalCliente({ clienteId, organizationId, canEdit }: Props) {
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: clientUsers = [], isLoading } = useQuery({
    queryKey: queryKeys.clientes.clientUsers(clienteId),
    queryFn: async () => {
      const { data, error } = await supabase.from("client_users").select("*").eq("cliente_id", clienteId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const inviteMutation = useInviteClientUser(clienteId);
  const revokeMutation = useRevokeClientUser(clienteId);

  const handleInvite = () => {
    inviteMutation.mutate(
      { email: inviteEmail, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: (data) => {
          toast({
            title: data.is_new ? "Invitación enviada" : "Usuario vinculado",
            description: data.is_new
              ? "Se creó la cuenta y se envió un correo para establecer contraseña."
              : "El usuario existente fue vinculado a este cliente.",
          });
          setInviteOpen(false);
          setInviteEmail("");
        },
        onError: (err: unknown) => {
          toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const handleRevoke = (id: string) => {
    revokeMutation.mutate(id, {
      onSuccess: () => toast({ title: "Acceso revocado" }),
      onError: (err: unknown) => toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> Acceso al Portal de Cliente
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Invitar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : clientUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay usuarios con acceso al portal para este cliente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario ID</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientUsers.map((cu) => (
                  <TableRow key={cu.id}>
                    <TableCell className="font-mono text-xs">{cu.user_id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-sm">
                      {cu.created_at ? formatDate(cu.created_at, "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(cu.id)} disabled={revokeMutation.isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Cliente al Portal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email del cliente</Label>
              <Input type="email" placeholder="cliente@empresa.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Se creará una cuenta con rol de cliente y se le enviará un correo para establecer su contraseña.
              Tendrá acceso solo a sus propios embarques, cotizaciones y facturas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviteMutation.isPending}>
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enviar Invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
