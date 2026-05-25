/**
 * Campana de notificaciones in-app del CRM en el header.
 */
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  useCrmNotificaciones,
  useCrmNotificacionesNoLeidasCount,
  useMarcarNotificacionesLeidas,
} from "@/hooks/crm";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function CrmNotificacionesBell() {
  const { data: items = [] } = useCrmNotificaciones(20);
  const { data: unread = 0 } = useCrmNotificacionesNoLeidasCount();
  const marcar = useMarcarNotificacionesLeidas();

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unread > 0) marcar.mutate(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notificaciones</span>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => marcar.mutate(undefined)}
              disabled={unread === 0}
            >
              <CheckCheck className="h-3 w-3" />
              Leídas
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Sin notificaciones</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const body = (
                  <div className="flex gap-2 px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5">
                      {n.leida_at ? (
                        <Check className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{n.titulo}</div>
                      {n.mensaje && (
                        <div className="text-[11px] text-muted-foreground line-clamp-2">{n.mensaje}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} className="block">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
