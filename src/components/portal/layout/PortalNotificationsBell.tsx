/**
 * Bloque 3.3 — Campanita de notificaciones para el portal de cliente.
 * Muestra contador de no leídas, dropdown con últimas 50 notificaciones,
 * marca como leída al hacer click y navega al recurso (embarque/factura).
 */
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Badge } from "@/components/ui/badge";
import {
  useNotificacionesCliente,
  useMarcarNotificacionLeida,
  useMarcarTodasLeidas,
  type NotificacionCliente,
} from "@/hooks/portal/useNotificacionesCliente";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PortalNotificationsBell() {
  const { data: items = [] } = useNotificacionesCliente();
  const marcar = useMarcarNotificacionLeida();
  const marcarTodas = useMarcarTodasLeidas();
  const navigate = useNavigate();
  const noLeidas = items.filter((n) => !n.leida_at).length;

  const onClick = (n: NotificacionCliente) => {
    if (!n.leida_at) marcar.mutate(n.id);
    if (n.url) navigate(n.url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {noLeidas > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] tabular-nums rounded-full"
            >
              {noLeidas > 99 ? "99+" : noLeidas}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notificaciones</span>
          {noLeidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => marcarTodas.mutate()}
              disabled={marcarTodas.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-8 text-center">
              Sin notificaciones por ahora.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onClick(n)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-muted transition-colors ${
                      !n.leida_at ? "bg-accent/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.leida_at && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-accent shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{n.titulo}</p>
                        {n.mensaje && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{n.mensaje}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                          {formatDate(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
