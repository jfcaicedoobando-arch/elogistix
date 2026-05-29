import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { UserPlus, Trash2, Globe, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/formatters";
import {
  useClientUsers,
  useInviteClientUser,
  useRevokeClientUser,
  useResendClientUserInvite,
} from "@/hooks/cliente";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { ClientUserEnriched } from "@/services/cliente-usuarios";

interface Props {
  clienteId: string;
  organizationId: string;
  canEdit: boolean;
}

function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null;
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function renderUltimoAcceso(last: string | null): { text: string; muted: boolean } {
  if (!last) return { text: "Nunca", muted: true };
  const dias = diasDesde(last) ?? 0;
  return {
    text: formatDate(last, "dd MMM yyyy HH:mm"),
    muted: dias > 30,
  };
}

function badgeEstado(u: ClientUserEnriched) {
  if (!u.email_confirmed_at || !u.last_sign_in_at) {
    return <Badge variant="outline">Pendiente</Badge>;
  }
  const dias = diasDesde(u.last_sign_in_at) ?? 0;
  if (dias > 60) return <Badge variant="secondary">Inactivo</Badge>;
  return <Badge variant="default">Activo</Badge>;
}

export default function TabPortalCliente({ clienteId, organizationId, canEdit }: Props) {
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: clientUsers = [], isLoading } = useClientUsers(clienteId);

  const inviteMutation = useInviteClientUser(clienteId);
  const revokeMutation = useRevokeClientUser(clienteId);
  const resendMutation = useResendClientUserInvite(clienteId);

  const handleInvite = () => {
    inviteMutation.mutate(
      { email: inviteEmail, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: (data) => {
          notifySuccess(toast, {
            title: data.is_new ? "Invitación enviada" : "Usuario vinculado",
            description: data.is_new
              ? "Se creó la cuenta y se envió un correo para establecer contraseña."
              : "El usuario existente fue vinculado a este cliente.",
          });
          setInviteOpen(false);
          setInviteEmail("");
        },
        onError: (err: unknown) => {
          notifyError(toast, { title: "Error", description: getErrorMessage(err), method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
        },
      }
    );
  };

  const handleRevoke = (id: string) => {
    revokeMutation.mutate(id, {
      onSuccess: () => notifySuccess(toast, { title: "Acceso revocado" }),
      onError: (err: unknown) => notifyError(toast, { title: "Error", description: getErrorMessage(err), method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED }),
    });
  };

  const handleResend = (u: ClientUserEnriched) => {
    resendMutation.mutate(
      { email: u.email, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: () => notifySuccess(toast, { title: "Invitación reenviada", description: `Se envió un nuevo correo a ${u.email}.` }),
        onError: (err: unknown) => notifyError(toast, { title: "Error", description: getErrorMessage(err), method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED }),
      },
    );
  };

  const count = clientUsers.length;
  const countBadge = count === 0
    ? <Badge variant="outline">Sin acceso</Badge>
    : <Badge variant="secondary">{count} usuario{count === 1 ? "" : "s"} con acceso</Badge>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> Acceso al Portal de Cliente
            {!isLoading && countBadge}
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Invitar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {(() => {
            const cols: ColumnDef<ClientUserEnriched, unknown>[] = defineColumns<ClientUserEnriched>([
              {
                id: "email",
                header: "Email",
                meta: { className: "text-sm" },
                cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
              },
              {
                id: "estado",
                header: "Estado",
                meta: { width: "w-28" },
                cell: ({ row }) => badgeEstado(row.original),
              },
              {
                id: "ultimo",
                header: "Último acceso",
                meta: { className: "text-sm" },
                cell: ({ row }) => {
                  const { text, muted } = renderUltimoAcceso(row.original.last_sign_in_at);
                  return <span className={muted ? "text-muted-foreground" : ""}>{text}</span>;
                },
              },
              {
                id: "desde",
                header: "Vinculado",
                meta: { className: "text-sm" },
                cell: ({ row }) => row.original.created_at ? formatDate(row.original.created_at, "dd MMM yyyy") : "—",
              },
              {
                id: "acc",
                header: "",
                meta: { width: "w-32" },
                cell: ({ row }) => {
                  if (!canEdit) return null;
                  const u = row.original;
                  const pendiente = !u.email_confirmed_at || !u.last_sign_in_at;
                  return (
                    <div className="flex items-center gap-1">
                      {pendiente && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reenviar invitación"
                          onClick={(e) => { e.stopPropagation(); handleResend(u); }}
                          disabled={resendMutation.isPending}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Revocar acceso"
                        onClick={(e) => { e.stopPropagation(); handleRevoke(u.id); }}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                },
              },
            ]);
            if (isLoading) {
              return <p className="text-sm text-muted-foreground">Cargando...</p>;
            }
            return (
              <DataTable
                columns={cols}
                data={clientUsers}
                rowKey={(cu) => cu.id}
                emptyMessage="No hay usuarios con acceso al portal para este cliente."
                density="compact"
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
              Tendrá acceso solo a sus propios embarques, cotizaciones y facturas. Puede agregar varios usuarios al mismo cliente.
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
