import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Trash2, Globe, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  clienteId: string;
  organizationId: string;
  canEdit: boolean;
}

export default function TabPortalCliente({ clienteId, organizationId, canEdit }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // Fetch client_users for this cliente
  const { data: clientUsers = [], isLoading } = useQuery({
    queryKey: ["client_users", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select("*")
        .eq("cliente_id", clienteId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("invite-client-user", {
        body: { email, cliente_id: clienteId, organization_id: organizationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.is_new ? "Invitación enviada" : "Usuario vinculado",
        description: data.is_new
          ? "Se creó la cuenta y se envió un correo para establecer contraseña."
          : "El usuario existente fue vinculado a este cliente.",
      });
      qc.invalidateQueries({ queryKey: ["client_users", clienteId] });
      setInviteOpen(false);
      setInviteEmail("");
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Acceso revocado" });
      qc.invalidateQueries({ queryKey: ["client_users", clienteId] });
    },
    onError: (err: unknown) => {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    },
  });

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
                      {cu.created_at ? format(new Date(cu.created_at), "dd MMM yyyy", { locale: es }) : "—"}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeMutation.mutate(cu.id)}
                          disabled={revokeMutation.isPending}
                        >
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
              <Input
                type="email"
                placeholder="cliente@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se creará una cuenta con rol de cliente y se le enviará un correo para establecer su contraseña.
              Tendrá acceso solo a sus propios embarques, cotizaciones y facturas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => inviteMutation.mutate(inviteEmail)}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Enviar Invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
