import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { UserPlus, Trash2, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatters";
import {
  useClientUsers,
  useInviteClientUser,
  useRevokeClientUser,
} from "@/hooks/cliente/useClientUsersMutations";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface Props {
  clienteId: string;
  organizationId: string;
  canEdit: boolean;
}

export default function TabPortalCliente({ clienteId, organizationId, canEdit }: Props) {
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: clientUsers = [], isLoading } = useClientUsers(clienteId);

  const inviteMutation = useInviteClientUser(clienteId);
  const revokeMutation = useRevokeClientUser(clienteId);

  const handleInvite = () => {
    inviteMutation.mutate(
      { email: inviteEmail, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: (data) => {
          notifySuccess(toast, {
            title: data.is_new ? "Invitación enviada" : "Usuario vinculado",
            description: data.is_new
              ? "Se creó la cuenta y se envió un correo para establecer contraseña."
              : "El usuario existente fue vinculado a este cliente."});
          setInviteOpen(false);
          setInviteEmail("");
        },
        onError: (err: unknown) => {
          notifyError(toast, { title: "Error", description: getErrorMessage(err)});
        },
      }
    );
  };

  const handleRevoke = (id: string) => {
    revokeMutation.mutate(id, {
      onSuccess: () => notifySuccess(toast, { title: "Acceso revocado" }),
      onError: (err: unknown) => notifyError(toast, { title: "Error", description: getErrorMessage(err)}),
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
          {(() => {
            type CU = typeof clientUsers[number];
            const cols: DataTableColumn<CU>[] = [
              { key: "uid", header: "Usuario ID", className: "font-mono text-xs", render: (cu) => `${cu.user_id.slice(0, 8)}...` },
              { key: "desde", header: "Desde", className: "text-sm", render: (cu) => cu.created_at ? formatDate(cu.created_at, "dd MMM yyyy") : "—" },
              { key: "acc", header: "", width: "w-20",
                render: (cu) => canEdit ? (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRevoke(cu.id); }} disabled={revokeMutation.isPending}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null },
            ];
            if (isLoading) {
              return <p className="text-sm text-muted-foreground">Cargando...</p>;
            }
            return (
              <DataTable
                columns={cols}
                data={clientUsers}
                rowKey={(cu) => cu.id}
                emptyMessage="No hay usuarios con acceso al portal para este cliente."
              />
            );
          })()}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className={dialogSize.md}>
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
