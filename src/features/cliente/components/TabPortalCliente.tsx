import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { ClientUserMobileCard } from "@/features/cliente/components/ClientUserMobileCard";
import { UserPlus, Trash2, Globe, Mail } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import {
  useClientUsers,
  useRevokeClientUser,
  useResendClientUserInvite,
} from "@/features/cliente/hooks";
import type { ClientUserEnriched } from "@/features/cliente/services/usuarios";
import PortalInviteDialog from "./PortalInviteDialog";
import { useState } from "react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Hint } from "@/components/shared/Hint";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { diffDiasCalendario } from "@/lib/date/dateOnly";

interface Props {
  clienteId: string;
  organizationId: string;
  canEdit: boolean;
}

function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null;
  return diffDiasCalendario(fecha, new Date());
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
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: clientUsers = [], isLoading } = useClientUsers(clienteId);

  const revokeMutation = useRevokeClientUser(clienteId);
  const resendMutation = useResendClientUserInvite(clienteId);

  // 13.85.10 — Los toasts los emiten los hooks (`useRevokeClientUser`, `useResendClientUserInvite`).
  // No pasar callbacks de notificación aquí: causaría doble toast.
  const handleRevoke = (id: string) => {
    revokeMutation.mutate(id);
  };

  const handleResend = (u: ClientUserEnriched) => {
    resendMutation.mutate({ email: u.email, cliente_id: clienteId, organization_id: organizationId });
  };


  const count = clientUsers.length;
  const countBadge = count === 0
    ? <Badge variant="outline">Sin acceso</Badge>
    : <Badge variant="secondary">{count} usuario{count === 1 ? "" : "s"} con acceso</Badge>;

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
              <Hint label="Reenviar invitación">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Reenviar invitación"
                  onClick={(e) => { e.stopPropagation(); handleResend(u); }}
                  disabled={resendMutation.isPending}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </Hint>
            )}
            <Hint label="Revocar acceso">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Revocar acceso"
                onClick={(e) => { e.stopPropagation(); handleRevoke(u.id); }}
                disabled={revokeMutation.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Hint>
          </div>
        );
      },
    },
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
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
          {isLoading ? (
            <EmptyStateInline loading message="Cargando…" className="py-4" />
          ) : (
            <ResponsiveDataTable
              columns={cols}
              data={clientUsers}
              rowKey={(cu) => cu.id}
              emptyMessage="No hay usuarios con acceso al portal para este cliente."
              density={TABLE_DENSITY.embebida}
              mobileCard={(cu) => (
                <ClientUserMobileCard
                  usuario={cu}
                  canEdit={canEdit}
                  onResend={handleResend}
                  onRevoke={handleRevoke}
                  resendPending={resendMutation.isPending}
                  revokePending={revokeMutation.isPending}
                />
              )}
            />
          )}
        </CardContent>
      </Card>

      <PortalInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        clienteId={clienteId}
        organizationId={organizationId}
      />
    </div>
  );
}
