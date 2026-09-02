/**
 * Tarjeta móvil del listado de usuarios del portal de cliente.
 * Extraída al migrar `TabPortalCliente` de `DataTable` a `ResponsiveDataTable`.
 */
import { Mail, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import { diffDiasCalendario } from "@/lib/date/dateOnly";
import type { ClientUserEnriched } from "@/features/cliente/services/usuarios";

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

interface Props {
  usuario: ClientUserEnriched;
  canEdit: boolean;
  onResend: (u: ClientUserEnriched) => void;
  onRevoke: (id: string) => void;
  resendPending: boolean;
  revokePending: boolean;
}

export function ClientUserMobileCard({
  usuario: u, canEdit, onResend, onRevoke, resendPending, revokePending,
}: Props) {
  const { text: ultimo, muted } = renderUltimoAcceso(u.last_sign_in_at);
  const pendiente = !u.email_confirmed_at || !u.last_sign_in_at;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-body truncate">{u.email}</div>
        <div className="mt-1">{badgeEstado(u)}</div>
        <div className={`text-label truncate mt-0.5 ${muted ? "text-muted-foreground" : ""}`}>
          Último acceso: {ultimo}
        </div>
        <div className="text-label text-muted-foreground truncate mt-0.5">
          Vinculado: {u.created_at ? formatDate(u.created_at, "dd MMM yyyy") : "—"}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          {pendiente && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reenviar invitación"
              onClick={(e) => { e.stopPropagation(); onResend(u); }}
              disabled={resendPending}
            >
              <Mail className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Revocar acceso"
            onClick={(e) => { e.stopPropagation(); onRevoke(u.id); }}
            disabled={revokePending}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}
